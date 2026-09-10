import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { motionTokens } from "../design";

export function Collapse({ open, children }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            duration: reduced ? 0 : motionTokens.panel,
            ease: motionTokens.ease,
          }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PanelMotion({ children, className = "" }) {
  const reduced = useReducedMotion();
  const mobile = window.matchMedia("(max-width: 767px)").matches;
  const offset = reduced ? {} : mobile ? { y: 32 } : { x: 32 };
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, ...offset }}
      transition={{
        duration: reduced ? 0 : motionTokens.panel,
        ease: motionTokens.ease,
      }}
    >
      {children}
    </motion.div>
  );
}

export function StorySection({ children, ...props }) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      {...props}
      initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: motionTokens.panel }}
    >
      {children}
    </motion.section>
  );
}
