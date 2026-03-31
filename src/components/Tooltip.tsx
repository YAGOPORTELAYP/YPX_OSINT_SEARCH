import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="absolute z-[9999] bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black border border-[#00ff00] text-[#00ff00] text-[9px] font-mono uppercase tracking-widest whitespace-nowrap pointer-events-none shadow-[0_0_10px_rgba(0,255,0,0.3)]"
          >
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-[#00ff00]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
