"use client";
import { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";

export const TextHoverEffect = ({
  text,
  duration,
  automatic = false,
}: {
  text: string;
  duration?: number;
  automatic?: boolean;
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });

  useEffect(() => {
    if (svgRef.current && cursor.x !== null && cursor.y !== null) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const cxPercentage = ((cursor.x - svgRect.left) / svgRect.width) * 100;
      const cyPercentage = ((cursor.y - svgRect.top) / svgRect.height) * 100;
      setMaskPosition({
        cx: `${cxPercentage}%`,
        cy: `${cyPercentage}%`,
      });
    }
  }, [cursor]);

  useEffect(() => {
    if (automatic) {
      let angle = 0;
      const interval = setInterval(() => {
        angle += 0.02;
        if (svgRef.current) {
          const svgRect = svgRef.current.getBoundingClientRect();
          const x = svgRect.left + svgRect.width / 2 + Math.cos(angle) * (svgRect.width * 0.4);
          const y = svgRect.top + svgRect.height / 2 + Math.sin(angle) * (svgRect.height * 0.4);
          setCursor({ x, y });
          setHovered(true);
        }
      }, 16);
      return () => clearInterval(interval);
    }
  }, [automatic]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 900 120"
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      className="select-none"
    >
      <defs>
        <linearGradient
          id="textGradient"
          gradientUnits="userSpaceOnUse"
          cx="50%"
          cy="50%"
          r="25%"
        >
          {(hovered || automatic) && (
            <>
              <stop offset="0%" stopColor="#a3ff12" />
              <stop offset="25%" stopColor="#53FC18" />
              <stop offset="50%" stopColor="#a3ff12" />
              <stop offset="75%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#a3ff12" />
            </>
          )}
        </linearGradient>

        <motion.radialGradient
          id="revealMask"
          gradientUnits="userSpaceOnUse"
          r="25%"
          animate={maskPosition}
          transition={{ duration: duration ?? 0, ease: "easeOut" }}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>
        <mask id="textMask">
          <rect
            x="0"
            y="0"
            width="900"
            height="120"
            fill="url(#revealMask)"
          />
        </mask>
      </defs>
      {/* Outlined base text */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.6"
        className="fill-transparent stroke-neutral-700 font-[sans-serif] font-bold uppercase tracking-[0.15em]"
        fontSize="88"
        fontFamily="sans-serif"
        fontWeight="700"
        letterSpacing="10"
      >
        {text}
      </text>
      {/* Gradient reveal text */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.6"
        className="fill-transparent stroke-neutral-500 font-[sans-serif] font-bold uppercase tracking-[0.15em]"
        stroke="url(#textGradient)"
        fontSize="88"
        fontFamily="sans-serif"
        fontWeight="700"
        letterSpacing="10"
        mask="url(#textMask)"
      >
        {text}
      </text>
    </svg>
  );
};
