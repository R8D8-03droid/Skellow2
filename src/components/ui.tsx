import {
  ButtonHTMLAttributes,
  Children,
  isValidElement,
  ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, AlertCircle, Search, X } from "lucide-react";
import { Employee, Shift } from "../types";
import { animateElement } from "../motion";

export const departmentTones: Record<string, string> = {
  Direction: "blue",
  "DJ/Animation": "lilac",
  Bar: "amber",
  Sécurité: "rose",
  "Accueil/Caisse": "sage",
  Vestiaire: "amber",
  "Ménage/Entretien": "blue",
};
export const toneFor = (department: string) =>
  departmentTones[department] || "sage";
export const personName = (person: Pick<Employee, "firstName" | "lastName">) =>
  `${person.firstName} ${person.lastName}`;
export const number = (value: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
export const money = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    value,
  );
export const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
export const shiftHours = (shift: Pick<Shift, "startTime" | "endTime">) =>
  ((minutes(shift.endTime) - minutes(shift.startTime) + 1440) % 1440) / 60;
export const isAbsent = (shift: Shift) =>
  shift.status === "absence_justified" ||
  shift.status === "absence_unjustified";
export const workedHours = (shifts: Shift[]) =>
  shifts.reduce(
    (sum, shift) => sum + (isAbsent(shift) ? 0 : shiftHours(shift)),
    0,
  );
export function overlaps(candidate: Shift, shifts: Shift[]) {
  const start = new Date(`${candidate.date}T${candidate.startTime}`).getTime();
  const end = start + shiftHours(candidate) * 3600000;
  return shifts.some((shift) => {
    if (
      shift.id === candidate.id ||
      shift.employeeId !== candidate.employeeId ||
      isAbsent(shift) ||
      isAbsent(candidate)
    )
      return false;
    const otherStart = new Date(`${shift.date}T${shift.startTime}`).getTime();
    const otherEnd = otherStart + shiftHours(shift) * 3600000;
    return start < otherEnd && end > otherStart;
  });
}
export function downloadText(
  filename: string,
  text: string,
  type = "text/csv;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob(["\uFEFF", text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const csvCell = (value: unknown) =>
  `"${String(value ?? "")
    .replace(/^[=+@-]/, "'$&")
    .replace(/"/g, '""')}"`;

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M11 7.5a4.5 4.5 0 0 1 9 0v17a4.5 4.5 0 0 1-9 0z"
            fill="currentColor"
            transform="rotate(45 16 16)"
          />
          <path
            d="M11 7.5a4.5 4.5 0 0 1 9 0v17a4.5 4.5 0 0 1-9 0z"
            fill="currentColor"
            opacity=".7"
            transform="rotate(-45 16 16)"
          />
          <circle cx="15.5" cy="16" r="3" fill="var(--forest)" />
        </svg>
      </span>
      {!compact && (
        <span>
          skellow<span className="brand-period">.</span>
        </span>
      )}
    </span>
  );
}
export function Button({
  variant = "secondary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      type="button"
      className={`button button-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function IconButton({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
export function Avatar({
  employee,
  size = "md",
}: {
  employee: Pick<Employee, "firstName" | "lastName" | "department">;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  return (
    <span
      className={`avatar avatar-${size} tone-${toneFor(employee.department)}`}
      aria-hidden="true"
    >
      {employee.firstName.charAt(0)}
      {employee.lastName.charAt(0)}
    </span>
  );
}
export function Badge({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: ReactNode;
  tone?: string;
  dot?: boolean;
}) {
  return (
    <span className={`badge tone-${tone}`}>
      {dot && <span className="status-dot" />}
      {children}
    </span>
  );
}
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">{children}</div>
    </header>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher…",
  label = "Rechercher",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <div className="search-field">
      <Search size={16} />
      <input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <IconButton label="Effacer la recherche" onClick={() => onChange("")}>
          <X size={14} />
        </IconButton>
      )}
    </div>
  );
}
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  label: string;
}) {
  return (
    <SelectionGroup className="segmented glass" value={value} label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={option.value === value}
          title={option.label}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </SelectionGroup>
  );
}
export function SelectionGroup({
  value,
  className,
  label,
  children,
}: {
  value: string;
  className: string;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const ink = useRef<HTMLDivElement>(null);
  const filled = !className.includes("tab-buttons");
  const previous = useRef<{ left: number; width: number }>();
  useLayoutEffect(() => {
    const group = ref.current;
    const track = indicator.current;
    if (!group || !track) return;
    let animation: Animation | null = null;
    let inkAnimation: Animation | null = null;
    const place = (animate: boolean) => {
      const active = group.querySelector<HTMLElement>(
        'button[aria-pressed="true"]',
      );
      if (!active || !active.offsetWidth) return;
      const next = { left: active.offsetLeft, width: active.offsetWidth };
      const before = previous.current;
      if (!animate && before?.left === next.left && before.width === next.width)
        return;
      animation?.cancel();
      inkAnimation?.cancel();
      track.style.left = `${next.left}px`;
      track.style.width = `${next.width}px`;
      track.style.visibility = "visible";
      const clip = (position: { left: number; width: number }) =>
        `inset(0px ${group.clientWidth - position.left - position.width}px 0px ${position.left}px)`;
      if (ink.current) {
        const buttons =
          group.querySelectorAll<HTMLButtonElement>(":scope > button");
        ink.current
          .querySelectorAll<HTMLElement>(".selection-ink-item")
          .forEach((item, index) => {
            const button = buttons[index];
            if (!button) return;
            Object.assign(item.style, {
              left: `${button.offsetLeft}px`,
              top: `${button.offsetTop}px`,
              width: `${button.offsetWidth}px`,
              height: `${button.offsetHeight}px`,
            });
          });
        ink.current.style.clipPath = clip(next);
        ink.current.style.visibility = "visible";
      }
      if (
        animate &&
        before &&
        (before.left !== next.left || before.width !== next.width)
      ) {
        animation = animateElement(track, [
          {
            transform: `translateX(${before.left - next.left}px) scaleX(${before.width / next.width})`,
          },
          { transform: "translateX(0) scaleX(1)" },
        ]);
        if (animation) {
          group.dataset.sliding = "true";
          animation.finished.then(
            () => delete group.dataset.sliding,
            () => {},
          );
        }
        if (ink.current)
          inkAnimation = animateElement(ink.current, [
            { clipPath: clip(before) },
            { clipPath: clip(next) },
          ]);
      }
      previous.current = next;
    };
    place(true);
    const resize = new ResizeObserver(() => place(false));
    resize.observe(group);
    return () => {
      const box = track.getBoundingClientRect();
      const groupBox = group.getBoundingClientRect();
      previous.current = {
        left: box.left - groupBox.left - group.clientLeft,
        width: box.width,
      };
      resize.disconnect();
      animation?.cancel();
      inkAnimation?.cancel();
      delete group.dataset.sliding;
    };
  }, [value]);
  return (
    <div
      ref={ref}
      className={`${className} selection-group`}
      role="group"
      aria-label={label}
    >
      <span ref={indicator} className="selection-track" aria-hidden="true" />
      {children}
      {filled && (
        <div ref={ink} className="selection-ink" aria-hidden="true">
          {Children.map(children, (child) =>
            isValidElement<{ children: ReactNode }>(child) ? (
              <span className="selection-ink-item">{child.props.children}</span>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <span className="empty-icon">{icon}</span>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  const exit = useRef<Animation | null>(null);
  onCloseRef.current = onClose;
  const dismiss = () => {
    const element = ref.current;
    if (exit.current) return;
    const current = element && getComputedStyle(element);
    const animation =
      element && !className.includes("command-dialog")
        ? animateElement(
            element,
            [
              { opacity: current!.opacity, transform: current!.transform },
              { opacity: 0, transform: "translateY(6px) scale(0.985)" },
            ],
            { duration: 140, fill: "forwards" },
          )
        : null;
    if (!animation) {
      onCloseRef.current();
      return;
    }
    exit.current = animation;
    element!.dataset.closing = "true";
    animation.finished.then(
      () => onCloseRef.current(),
      () => {},
    );
  };
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => {
      exit.current?.cancel();
      element?.close();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""} ${className}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onCloseRef.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            dismiss();
        }
      }}
    >
      <div className="dialog-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description && <p id={descriptionId}>{description}</p>}
        </div>
        <IconButton label="Fermer" onClick={dismiss}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>,
    document.body,
  );
}
export function Toast({
  message,
  tone = "success",
  onClose,
}: {
  message: string;
  tone?: "success" | "error";
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const exit = useRef<Animation | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismiss = () => {
    if (exit.current) return;
    const animation =
      ref.current &&
      animateElement(
        ref.current,
        [
          { opacity: 1, transform: "translateX(-50%) translateY(0)" },
          { opacity: 0, transform: "translateX(-50%) translateY(8px)" },
        ],
        { duration: 140, fill: "forwards" },
      );
    if (!animation) {
      onCloseRef.current();
      return;
    }
    exit.current = animation;
    animation.finished.then(
      () => onCloseRef.current(),
      () => {},
    );
  };
  useEffect(() => {
    exit.current?.cancel();
    exit.current = null;
    const timer = window.setTimeout(dismiss, 4500);
    return () => {
      clearTimeout(timer);
      exit.current?.cancel();
    };
  }, [message]);
  return createPortal(
    <div
      ref={ref}
      className={`toast glass toast-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="toast-check">
        {tone === "error" ? <AlertCircle size={15} /> : <Check size={15} />}
      </span>
      {message}
      <IconButton label="Masquer la notification" onClick={dismiss}>
        <X size={14} />
      </IconButton>
    </div>,
    document.body,
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className="text-link" onClick={onClick}>
      {children}
      <ArrowRight size={15} />
    </button>
  );
}
