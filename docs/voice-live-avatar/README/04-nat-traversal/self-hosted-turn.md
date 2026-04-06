# 4B. 自建 TURN 服务器实战指南

> 📖 返回 [第四章：NAT 穿透](./README.md) | 返回 [学习导航](../index.md)

---

本节面向需要自建 TURN 中继器的场景。如果你使用 Azure Voice Live（如本项目），Azure 已经内置了 TURN，无需自建。但如果你在开发自己的 WebRTC 应用，或者需要在非 Azure 环境中部署，本节的内容将非常实用。

**核心结论：加入 TURN 中继器的代码改动量极小。前端只改 `iceServers` 配置（约 5 行），后端新增一个凭据生成 API（约 30 行），信令代码零改动。真正的工作量在运维侧——部署和维护 TURN 服务器。**

---

## 没有 TURN 的最简 WebRTC 架构（基线）

在加入 TURN 之前，我们先看一个最简单的 WebRTC 架构是什么样的：

```
┌─────────────┐                              ┌─────────────┐
│  浏览器 A    │                              │  浏览器 B    │
│             │                              │             │
│ pc = new    │    WebSocket (信令)           │ pc = new    │
│ RTCPeer     │◄────────────────────────────►│ RTCPeer     │
│ Connection()│    SDP/ICE 交换               │ Connection()│
│             │                              │             │
│             │◄══════ WebRTC P2P ══════════►│             │
│             │    音视频直连                  │             │
└─────────────┘                              └─────────────┘
             │                                      │
     信令服务器（Python FastAPI WebSocket）
     只转发 JSON 消息，不碰媒体
```

最简前端代码（**无 TURN**）：

```javascript
// 无 TURN 版本 —— 只有 STUN
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }   // ← 只有 STUN
  ]
});

// ... 后续 SDP 交换代码 ...
```

这个架构在简单网络环境下可以工作，但一旦遇到企业防火墙或对称 NAT，就会失败。

---

## 加入 TURN 后的三处改动

### 改动 1：部署 TURN 服务器（基础设施层）

TURN 服务器是一个**独立运行的进程**，不是嵌入到你的 FastAPI 里的。你有两种选择：

**方案 A：自建 coturn（最流行的开源 TURN 服务器）**

需要一台有公网 IP 的服务器：

```bash
# 安装 coturn
sudo apt-get install coturn

# 配置 /etc/turnserver.conf
cat > /etc/turnserver.conf << 'EOF'
# 基础配置
listening-port=3478              # 标准 TURN 端口
tls-listening-port=443           # TLS 端口（穿透力最强）
external-ip=YOUR_PUBLIC_IP       # 你的公网 IP

# 中继范围
min-port=49152
max-port=65535

# 认证
use-auth-secret                  # 使用共享密钥生成临时凭据
static-auth-secret=MY_SECRET_KEY # 和后端共享的密钥
realm=my-app.com

# TLS 证书（用于 443 端口）
cert=/etc/letsencrypt/live/turn.my-app.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.my-app.com/privkey.pem

# 日志
log-file=/var/log/turnserver.log
EOF

# 启动
sudo systemctl start coturn
```

**方案 B：使用云服务（零运维）**

```bash
# - Twilio TURN（按流量计费）
# - Xirsys（全球节点）
# - Azure 内置 TURN（本项目用的就是这个，Azure Voice Live 自动提供）
```

### 改动 2：后端生成临时 TURN 凭据

后端需要新增一个 API 端点，用共享密钥为前端生成临时凭据：

```python
# backend/app/api/turn.py — 新增文件

import hashlib
import hmac
import base64
import time
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.config import get_settings

router = APIRouter(prefix="/api/v1/turn", tags=["turn"])

@router.get("/credentials")
async def get_turn_credentials(user=Depends(get_current_user)):
    """
    生成临时 TURN 凭据。
    使用 TURN REST API 标准（RFC 中的 time-limited credentials 方案）。
    """
    settings = get_settings()

    # 凭据有效期：当前时间 + TTL（通常 1-24 小时）
    ttl = 86400  # 24 小时
    expiry = int(time.time()) + ttl

    # username = "过期时间戳:用户ID"
    username = f"{expiry}:{user.id}"

    # password = HMAC-SHA1(共享密钥, username)
    password = base64.b64encode(
        hmac.new(
            settings.turn_secret.encode("utf-8"),  # 和 coturn 配置里的 static-auth-secret 一样
            username.encode("utf-8"),
            hashlib.sha1
        ).digest()
    ).decode("utf-8")

    return {
        "ice_servers": [
            {
                "urls": [
                    f"turn:{settings.turn_server}:3478?transport=udp",   # UDP 优先
                    f"turn:{settings.turn_server}:3478?transport=tcp",   # TCP 降级
                    f"turns:{settings.turn_server}:443?transport=tcp",   # TLS 兜底
                ],
                "username": username,
                "credential": password,
            },
            {
                "urls": f"stun:{settings.turn_server}:3478",  # STUN 也提供
            }
        ],
        "ttl": ttl,
    }
```

配置中需要新增：

```python
# backend/app/config.py 中添加
class Settings(BaseSettings):
    # ... 现有配置 ...

    # TURN 配置
    turn_server: str = "turn.my-app.com"           # TURN 服务器域名
    turn_secret: str = "MY_SECRET_KEY"             # 和 coturn 共享的密钥
```

### 改动 3：前端请求凭据并传入 RTCPeerConnection

前端改动很小，只需要在创建 `RTCPeerConnection` 之前，先请求凭据：

```javascript
// ===== 改动前（无 TURN） =====
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
});


// ===== 改动后（有 TURN） =====

// Step 1: 从后端获取 TURN 凭据
const response = await fetch("/api/v1/turn/credentials", {
  headers: { Authorization: `Bearer ${token}` }
});
const { ice_servers } = await response.json();

// Step 2: 传给 RTCPeerConnection
const pc = new RTCPeerConnection({
  iceServers: ice_servers    // ← 唯一的改动！
});

// Step 3: 后续代码完全不变
pc.addTransceiver("video", { direction: "sendrecv" });
pc.addTransceiver("audio", { direction: "sendrecv" });
// ... SDP 交换、ontrack 等 ...
```

**信令服务器（后端 WebSocket）的代码完全不需要改**——它只转发 SDP 和 ICE candidate，和有没有 TURN 完全无关。

---

## 改动汇总

```
┌──────────────────┬──────────────────────────────────────────────────┐
│ 组件              │ 需要改什么                                        │
├──────────────────┼──────────────────────────────────────────────────┤
│ TURN 服务器       │ 新增部署。独立的进程，有公网 IP                    │
│ (coturn/云服务)   │ 配置：端口、TLS 证书、共享密钥                    │
├──────────────────┼──────────────────────────────────────────────────┤
│ 后端 (FastAPI)    │ 新增 1 个 API 端点 /turn/credentials             │
│                  │ 用共享密钥生成临时凭据                             │
│                  │ config.py 新增 turn_server 和 turn_secret         │
├──────────────────┼──────────────────────────────────────────────────┤
│ 后端 WebSocket    │ ❌ 不需要改！信令转发和 TURN 完全无关              │
│ (信令服务器)      │                                                  │
├──────────────────┼──────────────────────────────────────────────────┤
│ 前端              │ 改 1 处：创建 RTCPeerConnection 时               │
│                  │ 用后端返回的 ice_servers 替换硬编码的 STUN         │
│                  │ 其余代码（SDP 交换、ontrack 等）完全不变           │
├──────────────────┼──────────────────────────────────────────────────┤
│ TURN 服务器代码   │ coturn 是现成的，不需要自己写中继代码              │
│                  │ 你只需要写配置文件，不需要写转发逻辑               │
└──────────────────┴──────────────────────────────────────────────────┘
```

---

## 完整架构图（加入 TURN 后）

```
┌─────────────┐                                    ┌─────────────┐
│  浏览器 A    │                                    │  浏览器 B    │
│             │     WebSocket (信令)                │             │
│             │◄──────────────────────────────────►│             │
│             │     SDP/ICE 交换                    │             │
│             │                                    │             │
│  ICE Agent  │     尝试 1: 直连 (UDP P2P)          │  ICE Agent  │
│  自动选路    │◄═══════════════════════════════════►│  自动选路    │
│             │     可能成功✓ 也可能失败✗            │             │
│             │                                    │             │
│             │     尝试 2: 经 TURN 中继             │             │
│             │──出站──►┌────────────┐◄──出站──────│             │
│             │         │ TURN 服务器 │              │             │
│             │◄────────│  (coturn)   │────────────►│             │
│             │  中继转发│  公网 IP    │  中继转发    │             │
└─────────────┘         └────────────┘              └─────────────┘
      │                       │                           │
      │              信令服务器 (FastAPI)                   │
      │              + TURN 凭据 API                       │
      │              只管信令和凭据                          │
      │              不碰媒体流                              │
```

---

## 关键要点总结

加入 TURN 中继器的代码改动量极小：

- **前端**：只改 `iceServers` 配置（约 5 行代码）
- **后端**：新增一个凭据生成 API（约 30 行代码）
- **信令代码**：零改动
- **真正的工作量**：在运维侧——部署和维护 TURN 服务器

这也是为什么很多团队选择使用 Azure 内置 TURN 或 Twilio 等云服务，省去运维成本。在本项目中，Azure Voice Live 已经为我们处理了所有这些，开发者只需要正确传递 Azure 返回的 `iceServers` 即可。
