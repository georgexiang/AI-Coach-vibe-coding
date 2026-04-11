FROM python:3.12-slim

# git is required for git: source in AGENT_SKILLS
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . user_agent/
WORKDIR /app/user_agent

RUN pip install -r requirements.txt

EXPOSE 8088

CMD ["python", "main.py"]
