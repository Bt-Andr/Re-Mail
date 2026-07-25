import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function RouteTransitionBar() {
  const status = useRouterState({ select: (s) => s.status });
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (status === "pending") {
      setVisible(true);
      setProgress(30);
      const t1 = setTimeout(() => setProgress(70), 200);
      return () => clearTimeout(t1);
    } else {
      setProgress(100);
      const t = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 350);
      return () => clearTimeout(t);
    }
  }, [status]);

  if (!visible && progress === 0) return null;

  return (
    <div className="fixed left-0 top-0 z-[100] h-[4px] w-full overflow-hidden">
      <div
        className="h-full bg-[var(--brand)] shadow-[0_0_8px_rgba(2,237,119,0.6)]"
        style={{
          width: `${progress}%`,
          transition: "width 350ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </div>
  );
}
