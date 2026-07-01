"""Audio transcoding helpers for voice scoring."""

import asyncio
import logging

logger = logging.getLogger(__name__)


async def transcode_audio_to_wav_pcm(
    audio_data: bytes,
    timeout_seconds: int = 120,
) -> bytes:
    """Transcode compressed audio bytes to 16 kHz mono WAV PCM using ffmpeg."""
    try:
        process = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            "pipe:0",
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-acodec",
            "pcm_s16le",
            "-f",
            "wav",
            "pipe:1",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        raise RuntimeError("ffmpeg is required for voice scoring audio transcoding") from exc

    try:
        stdout, stderr = await asyncio.wait_for(
            process.communicate(audio_data),
            timeout=timeout_seconds,
        )
    except TimeoutError as exc:
        process.kill()
        await process.wait()
        raise RuntimeError(f"Audio transcoding timed out after {timeout_seconds} seconds") from exc

    if process.returncode != 0:
        message = stderr.decode("utf-8", errors="replace").strip()
        logger.error("Audio transcoding failed: %s", message)
        raise RuntimeError(f"Audio transcoding failed: {message}")

    if not stdout:
        raise RuntimeError("Audio transcoding produced no output")

    return stdout
