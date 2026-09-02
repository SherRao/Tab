"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";

type RevealProps = {
  children: ReactNode;
  as?: "div" | "li";
  className?: string;
  delay?: number;
  variant?: "up" | "stamp";
};

export function Reveal({
  children,
  as = "div",
  className = "",
  delay = 0,
  variant = "up",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const style = { "--delay": `${delay}ms` } as CSSProperties;
  const classes = [
    "reveal",
    variant === "stamp" ? "stamp-in" : "",
    visible ? "is-visible" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return as === "li" ? (
    <li ref={ref as Ref<HTMLLIElement>} style={style} className={classes}>
      {children}
    </li>
  ) : (
    <div ref={ref as Ref<HTMLDivElement>} style={style} className={classes}>
      {children}
    </div>
  );
}
