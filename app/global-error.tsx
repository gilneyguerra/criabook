"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "Georgia, serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Algo deu errado</h2>
        <p style={{ maxWidth: 420, fontSize: "0.875rem", color: "#666" }}>
          Ocorreu um erro inesperado. Tente recarregar.
        </p>
        {error?.message && (
          <pre
            style={{
              maxWidth: 420,
              overflow: "auto",
              background: "#f3f3f3",
              padding: "0.75rem",
              fontSize: "0.75rem",
              textAlign: "left",
            }}
          >
            {error.message}
            {error.digest ? `\n(digest: ${error.digest})` : ""}
          </pre>
        )}
        <button
          onClick={reset}
          style={{
            borderRadius: 999,
            background: "#6366f1",
            color: "#fff",
            padding: "0.5rem 1.25rem",
            fontSize: "0.875rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
