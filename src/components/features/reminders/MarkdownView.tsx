import { lazy, Suspense } from "react";

const ReactMarkdown = lazy(() => import("react-markdown"));

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export function MarkdownView({ content, className }: MarkdownViewProps) {
  return (
    <Suspense fallback={<p className={className}>{content}</p>}>
      <div className={className}>
        <ReactMarkdown
          components={{
            a: ({ children }) => <span>{children}</span>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </Suspense>
  );
}
