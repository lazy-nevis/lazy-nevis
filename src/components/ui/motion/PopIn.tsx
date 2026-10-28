import { motion, type HTMLMotionProps } from "motion/react";

/** Scale-and-fade entrance for popovers, badges and panels. Wrap in AnimatePresence for exits. */
export function PopIn({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -4 }}
      transition={{ type: "spring", bounce: 0.2, visualDuration: 0.2 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
