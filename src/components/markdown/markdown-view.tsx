"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { stripFrontmatter } from "@/plugins/knowledge/frontmatter";

type MarkdownViewProps = {
  content: string;
  className?: string;
};

export function MarkdownView({ content, className }: MarkdownViewProps) {
  const body = stripFrontmatter(content);

  if (!body.trim()) {
    return <p className="text-sm text-muted">Sem conteudo.</p>;
  }

  return (
    <div className={cn("markdown-body", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mb-4 mt-6 text-2xl font-semibold first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-3 mt-6 text-xl font-semibold first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-5 text-lg font-semibold first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-2 mt-4 text-base font-semibold">{children}</h4>,
          p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-6">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-4 border-brand/40 pl-4 italic text-muted">{children}</blockquote>
          ),
          hr: () => <hr className="my-6 border-border" />,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2 hover:opacity-80">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ className: codeClass, children, ...props }) => {
            const isBlock = codeClass?.includes("language-");
            if (isBlock) {
              return (
                <code className={cn("font-mono text-xs", codeClass)} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-[0.85em] text-fg" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-4 overflow-x-auto rounded-lg border border-border bg-surface2 p-4 text-sm leading-relaxed">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[320px] border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-surface2">{children}</thead>,
          th: ({ children }) => <th className="border-b border-border px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-border px-3 py-2 align-top">{children}</td>,
          tr: ({ children }) => <tr className="even:bg-surface2/40">{children}</tr>,
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt ?? ""} className="my-4 max-w-full rounded-lg border border-border" />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
