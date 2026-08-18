import { motion } from "motion/react";

const HERO_BG = "https://assets.watermelon.sh/hero-26-bg.avif";

const bgVariants = {
  hidden: { opacity: 0, x: 30, scale: 1.04 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 1.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function Hero26Bg({ src = HERO_BG }) {
  return (
    <>
      <motion.img
        src={src}
        alt=""
        aria-hidden="true"
        className="hero26-bg"
        variants={bgVariants}
        initial="hidden"
        animate="visible"
      />
      <div className="hero26-dim" aria-hidden="true" />
    </>
  );
}
