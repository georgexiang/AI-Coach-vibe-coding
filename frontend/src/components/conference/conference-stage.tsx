interface ConferenceStageProps {
  sessionId: string;
  onSendMessage: (text: string) => void;
  isStreaming: boolean;
  streamedText: string;
  currentSpeaker: string;
  avatarEnabled: boolean;
  featureAvatarEnabled: boolean;
}

// Stub: will be fully implemented in Task 2
export function ConferenceStage({
  sessionId: _sid,
  onSendMessage: _sm,
  isStreaming: _is,
  streamedText: _st,
  currentSpeaker: _cs,
  avatarEnabled: _ae,
  featureAvatarEnabled: _fae,
}: ConferenceStageProps) {
  return null;
}
