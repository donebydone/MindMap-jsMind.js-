// pages/api/commandOpenai.js

import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const {
    openAIKey,
    defaultAssistantId,
    prompt,
    threadId,
    nodes,
    selectNode,
    brothers,
    parents,
  } = req.body;

  if (!openAIKey) {
    return res.status(400).json({ error: "OpenAI API key is required" });
  }

  const brotherNodes = getNodeSummary(brothers);
  const parentNodes = getNodeSummary(parents);

  const openai = new OpenAI({ apiKey: openAIKey });

  try {
    await openai.models.list();

    const message = await createThreadMessage(
      openai,
      threadId,
      nodes,
      brotherNodes,
      parentNodes,
      selectNode,
      prompt
    );
    console.log(message.content);

    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: defaultAssistantId,
    });
    await checkStatus(openai, threadId, run.id);

    const messages = await openai.beta.threads.messages.list(threadId);
    const messageValue = messages.body.data[0].content[0].text.value;
    const messageContent = JSON.parse(messageValue);

    console.log(messageContent);

    const normalizedResponse = normalizeResponse(messageContent);
    res.status(200).json({ message: normalizedResponse });
  } catch (error) {
    handleError(res, error);
  }
}

function getNodeSummary(nodes) {
  return Object.entries(nodes)
    .filter(([, value]) => value)
    .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1))
    .join(", ");
}

async function createThreadMessage(
  openai,
  threadId,
  nodes,
  brotherNodes,
  parentNodes,
  selectNode,
  prompt
) {
  return await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: `Be specific and don't write more than 10 words. Current mindmap is ${nodes} and read carefully ${brotherNodes} nodes and ${parentNodes} nodes of ${selectNode}. ${prompt} for node of ${selectNode}.`,
  });
}

async function checkStatus(openai, threadId, runId) {
  let isComplete = false;
  while (!isComplete) {
    const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
    if (runStatus.status === "completed") {
      isComplete = true;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

function normalizeResponse(messageContent) {
  const keys = Object.keys(messageContent);
  const content = messageContent[keys[1]];
  return {
    type: messageContent.type,
    content,
  };
}

function handleError(res, error) {
  if (error && error.status === 401) {
    res.status(401).json({ error: "Invalid OpenAI API key" });
  } else if (error && error.status) {
    res.status(error.status).json({ error: error.data });
  } else {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
}
