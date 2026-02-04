import { motion, useMotionValue, useSpring, useAnimationFrame, useTransform } from "motion/react";
import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import { SubAgent } from "./types";

export type NucleusState = "idle" | "thinking" | "tooling" | "waiting" | "error";

interface NucleusProps {
  state: NucleusState;
  className?: string;
  subAgents?: SubAgent[];
}

// Configuration for physics parameters per state
const STATE_CONFIG = {
  idle: {
    baseScale: 1,
    driftSpeed: 0.4,    // How fast the centroid wanders
    orbitSpeed: 0.5,    // How fast rings rotate/move relative to each other
    driftRange: 15,     // Max pixels the centroid moves from center
    spread: 12,         // Separation between rings
    tension: 0.5,       // Smoothness factor (not strictly used in this math, but conceptually)
    deformation: 0.1    // Amount of squish
  },
  thinking: {
    baseScale: 0.85,
    driftSpeed: 0.1,    // Centroid stays tighter
    orbitSpeed: 2.5,    // Rings spin fast
    driftRange: 5,
    spread: 4,          // Tight cluster
    tension: 0.8,
    deformation: 0.05
  },
  tooling: {
    baseScale: 1.1,
    driftSpeed: 0.8,    // Active wandering
    orbitSpeed: 1.2,
    driftRange: 25,     // Large movements
    spread: 30,         // Rings pull apart (budding effect)
    tension: 0.4,
    deformation: 0.3
  },
  waiting: {
    baseScale: 1,
    driftSpeed: 0.05,   // Almost frozen
    orbitSpeed: 0.1,
    driftRange: 2,
    spread: 5,
    tension: 0.9,
    deformation: 0
  },
  error: {
    baseScale: 1,
    driftSpeed: 5,      // Jitter
    orbitSpeed: 8,
    driftRange: 10,
    spread: 20,
    tension: 1,
    deformation: 0.5
  }
};

// Helper hook to smooth values
function useSmoothState(target: number, config = { stiffness: 100, damping: 20 }) {
  const value = useSpring(target, config);
  useEffect(() => {
    value.set(target);
  }, [target, value]);
  return value;
}

export function Nucleus({ state, className, subAgents = [] }: NucleusProps) {
  const ringColor = "#1A1D21";
  
  // 1. Setup Smooth Parameters
  // We use springs to interpolate between state configurations
  const config = STATE_CONFIG[state];
  
  const smoothScale = useSmoothState(config.baseScale);
  const smoothDriftSpeed = useSmoothState(config.driftSpeed);
  const smoothOrbitSpeed = useSmoothState(config.orbitSpeed);
  const smoothDriftRange = useSmoothState(config.driftRange);
  const smoothSpread = useSmoothState(config.spread);
  
  // 2. Motion Values for Rings (X, Y)
  // We have 3 main rings + 1 core
  const r1x = useMotionValue(0);
  const r1y = useMotionValue(0);
  const r2x = useMotionValue(0);
  const r2y = useMotionValue(0);
  const r3x = useMotionValue(0);
  const r3y = useMotionValue(0);
  
  // Continuous time ref
  const time = useRef(0);
  
  // 3. Animation Loop
  useAnimationFrame((_, delta) => {
    // Increment time based on drift speed (delta is in ms)
    // We normalize delta to seconds roughly
    const dt = delta / 1000;
    
    // Accumulate time. Note: We use the current smoothed speed to scale time progression
    // This allows time to "slow down" or "speed up" without resetting
    time.current += dt * smoothOrbitSpeed.get();
    
    const t = time.current;
    const range = smoothDriftRange.get();
    const spread = smoothSpread.get();
    
    // Ring 1: Outer drift (Slow, wide)
    // Uses a mix of sine waves for non-repeating feel
    r1x.set(Math.sin(t * 0.8) * range + Math.cos(t * 0.3) * spread);
    r1y.set(Math.cos(t * 0.7) * range + Math.sin(t * 0.4) * spread);
    
    // Ring 2: Middle drift (Opposite phase, slightly faster)
    r2x.set(Math.sin(t * 1.1 + 2) * range * 0.8 + Math.cos(t * 0.5) * spread * 0.8);
    r2y.set(Math.cos(t * 0.9 + 1) * range * 0.8 + Math.sin(t * 0.6) * spread * 0.8);
    
    // Ring 3: Core drift (Stays closer to center, anchors the shape)
    r3x.set(Math.sin(t * 0.5) * (range * 0.3));
    r3y.set(Math.cos(t * 0.4) * (range * 0.3));
  });

  return (
    <div className={clsx("relative flex items-center justify-center w-[400px] h-[400px]", className)}>
      {/* SVG Filters */}
      <svg className="absolute w-0 h-0">
        <defs>
          <filter id="goo-rings-v2">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" 
              result="goo" 
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
          </filter>
        </defs>
      </svg>

      {/* Main Container with Goo Filter */}
      <div 
         className="relative w-full h-full flex items-center justify-center will-change-transform"
         style={{ filter: "url(#goo-rings-v2)" }}
      >
         {/* Sub-agents (Blobs) */}
         {subAgents.map((agent, i) => (
            <motion.div
               key={agent.id}
               className="absolute w-12 h-12 bg-[#1A1D21] rounded-full"
               initial={{ x: 0, y: 0, scale: 0 }}
               animate={{ 
                  x: 160 + (i * 40), 
                  y: -70 + (i * 20),
                  scale: 1 
               }}
               exit={{ x: 0, y: 0, scale: 0 }}
               transition={{ duration: 1.2, type: "spring", bounce: 0.2 }}
            />
         ))}

         {/* Ring 1 (Large Outer) */}
         <motion.div
            className="absolute w-48 h-48 bg-transparent border-[18px] rounded-full"
            style={{ 
               borderColor: ringColor,
               x: r1x,
               y: r1y,
               scale: smoothScale
            }}
         />
         
         {/* Ring 2 (Medium Middle) */}
         <motion.div
            className="absolute w-32 h-32 bg-transparent border-[18px] rounded-full"
            style={{ 
               borderColor: ringColor,
               x: r2x,
               y: r2y,
               scale: smoothScale
            }}
         />

         {/* Ring 3 (Core Solid) */}
         <motion.div
            className="absolute w-20 h-20 bg-[#1A1D21] rounded-full"
            style={{ 
               x: r3x,
               y: r3y,
               scale: smoothScale
            }}
         />

         {/* Optional: Floating "Particles" for texture in Thinking/Tooling modes */}
         {/* These add small details that merge into the main blobs */}
         <motion.div
             className="absolute w-8 h-8 bg-[#1A1D21] rounded-full opacity-80"
             style={{
                x: useTransform(r1x, v => v * -0.5), // Moves opposite
                y: useTransform(r1y, v => v * -0.5),
                scale: useTransform(smoothScale, s => s * 0.5)
             }}
         />
      </div>
    </div>
  );
}
