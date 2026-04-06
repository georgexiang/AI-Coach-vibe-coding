# 附录 B：通用术语速查

> 返回 [学习导航](../index.md) | 返回 [附录 A：WebRTC 核心术语详解](./webrtc-glossary.md)

---

以下是本手册中涉及的通用技术术语速查表。这些术语不局限于 WebRTC，而是整个 Voice Live + Avatar 技术栈中会反复出现的基础概念。

| 术语 | 解释 |
|------|------|
| **WebSocket** | 基于 TCP 的全双工通信协议，浏览器和服务器可以互相推送消息。用 `wss://` URL 连接。 |
| **WebRTC** | Web Real-Time Communication，浏览器原生的实时音视频通信技术。用 ICE/SDP 协商连接，无 URL。 |
| **PCM16** | 脉冲编码调制，16bit 采样深度，无压缩的原始音频格式。本项目中 WebSocket 音频用此格式。 |
| **Opus** | 一种高效音频压缩编码，WebRTC 默认使用。延迟低，压缩比高。 |
| **H.264** | 视频压缩标准。本项目中 WebRTC 传输数字人视频用此编码。 |
| **VAD** | Voice Activity Detection，语音活动检测。Azure 用它判断用户是否在说话，决定何时触发 AI 回复。 |
| **AudioWorklet** | 浏览器音频处理 API，在独立线程中采集麦克风数据。比旧的 ScriptProcessorNode 性能更好。 |
| **base64** | 一种将二进制数据（如音频字节）编码为纯文本字符串的方式，以便塞进 JSON 传输。 |
| **NAT** | Network Address Translation，网络地址转换。家庭/企业路由器把内网地址映射为公网地址的机制，是 WebRTC 需要 ICE 穿透的根本原因。 |
| **RTP/SRTP** | Real-time Transport Protocol，实时传输协议。WebRTC 用它在 UDP 上传输音视频帧。SRTP 是加密版本。 |

---

> 返回 [学习导航](../index.md) | 返回 [附录 A：WebRTC 核心术语详解](./webrtc-glossary.md)
