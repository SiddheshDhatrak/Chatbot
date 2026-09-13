import ChatClient from "../ChatClient";

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatClient sessionId={id} />;
}
