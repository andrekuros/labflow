"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button, Textarea, Avatar } from "@/components/ui";
import { createPost, fetchPosts } from "@/plugins/forum/actions";

type Post = { id: string; content: string; createdAt: string; authorName: string; authorColor: string };

/** Thread view with near-realtime updates via lightweight polling. */
export function ThreadView({ threadId, initialPosts }: { threadId: string; initialPosts: Post[] }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [content, setContent] = useState("");
  const [pending, start] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const fresh = await fetchPosts(threadId);
      setPosts((prev) => (fresh.length !== prev.length ? fresh : prev));
    }, 4000);
    return () => clearInterval(interval);
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [posts.length]);

  function send() {
    if (!content.trim()) return;
    const text = content;
    setContent("");
    start(async () => {
      await createPost({ threadId, content: text });
      setPosts(await fetchPosts(threadId));
    });
  }

  return (
    <div>
      <div className="space-y-3">
        {posts.map((p) => (
          <div key={p.id} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
            <Avatar name={p.authorName} color={p.authorColor} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{p.authorName}</span>
                <span className="text-[11px] text-muted">{new Date(p.createdAt).toLocaleString("pt-BR")}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{p.content}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 flex items-end gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
          rows={3}
          placeholder="Escreva uma resposta... (Ctrl+Enter para enviar)"
        />
        <Button onClick={send} disabled={pending || !content.trim()}><Send size={15} /></Button>
      </div>
    </div>
  );
}
