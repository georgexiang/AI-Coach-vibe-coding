# Scoring Module Specification

## Multi-dimensional Scoring

### GIVEN a completed coaching session
### WHEN the scoring is triggered
### THEN the system generates scores for each dimension:
- Key Message Delivery (0-100)
- Objection Handling (0-100)
- Communication Skills (0-100)
- Product Knowledge (0-100)
- Overall Engagement (0-100)

## Real-time Suggestions

### GIVEN an in-progress coaching session
### WHEN the MR sends a message
### THEN the system may return coaching hints via SSE:
- Missed key messages to mention
- Better phrasing suggestions
- Objection response strategies

## Score Persistence

### GIVEN a scored session
### WHEN the score is saved
### THEN the following are persisted:
- SessionScore (overall + per-dimension averages)
- ScoreDetail (individual dimension scores with feedback text)
- Session status transitions to "scored"
