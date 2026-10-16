import { RefObject, useEffect, useLayoutEffect, useRef } from "react";

const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const running = new Set<Animation>();

export const motionAllowed = () =>
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
  document.documentElement.dataset.motion !== "reduced" &&
  document.documentElement.dataset.input !== "keyboard";

/** A single policy for programmatic motion, including animations already in flight. */
export function installMotionPolicy() {
  const reduce = () => {
    if (!motionAllowed()) running.forEach((animation) => animation.finish());
  };
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const observer = new MutationObserver(reduce);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-motion", "data-input"],
  });
  media.addEventListener("change", reduce);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", reduce);
    running.forEach((animation) => animation.cancel());
    running.clear();
  };
}

export function animateElement(
  element: Element,
  frames: Keyframe[],
  options: KeyframeAnimationOptions = {},
) {
  if (!motionAllowed() || !element.animate) return null;
  const animation = element.animate(frames, {
    duration: 260,
    easing: ease,
    fill: "backwards",
    ...options,
  });
  running.add(animation);
  animation.finished.then(
    () => running.delete(animation),
    () => running.delete(animation),
  );
  return animation;
}

/** Keep the calendar frame still; only the changed time period moves. */
export function useContentTransition<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null);
  const previous = useRef(key);
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = key;
    if (before === key || !ref.current) return;
    const direction = key > before ? 1 : -1;
    const animation = animateElement(
      ref.current,
      [
        { opacity: 1, transform: `translateX(${direction * 12}px)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 220 },
    );
    return () => animation?.cancel();
  }, [key]);
  return ref;
}

/** FLIP keeps people recognizable as a filter changes their place in the grid. */
export function useCollectionMotion(key: string) {
  const ref = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, { left: number; top: number }>());
  useLayoutEffect(() => {
    if (!ref.current) return;
    const container = ref.current.getBoundingClientRect();
    const next = new Map<string, { left: number; top: number }>();
    const animations: Animation[] = [];
    const children =
      ref.current.querySelectorAll<HTMLElement>("[data-motion-key]");
    children.forEach((element, index) => {
      const id = element.dataset.motionKey!;
      const rect = element.getBoundingClientRect();
      const position = {
        left: rect.left - container.left,
        top: rect.top - container.top,
      };
      next.set(id, position);
      const old = positions.current.get(id);
      const x = old ? old.left - position.left : 0;
      const y = old ? old.top - position.top : 8;
      if (old && Math.abs(x) < 1 && Math.abs(y) < 1) return;
      const animation = animateElement(
        element,
        [
          { opacity: old ? 1 : 0, transform: `translate(${x}px, ${y}px)` },
          { opacity: 1, transform: "translate(0, 0)" },
        ],
        { delay: old ? 0 : Math.min(index, 5) * 24, duration: old ? 240 : 280 },
      );
      if (animation) animations.push(animation);
    });
    positions.current = next;
    return () => animations.forEach((animation) => animation.cancel());
  }, [key]);
  return ref;
}

/** Read the night's duration from left to right, once it enters the viewport. */
export function useTimelineReveal(ref: RefObject<HTMLElement>, date: string) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const animations: Animation[] = [];
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        element.querySelectorAll(".timeline-event").forEach((event, index) => {
          const animation = animateElement(
            event,
            [
              { opacity: 1, clipPath: "inset(0 90% 0 0 round 6px)" },
              { opacity: 1, clipPath: "inset(0 0% 0 0 round 6px)" },
            ],
            { duration: 400, delay: Math.min(index, 4) * 30 },
          );
          if (animation) animations.push(animation);
        });
      },
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
    };
  }, [ref, date]);
}
