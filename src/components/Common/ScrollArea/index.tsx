import { _ } from "@/lib/lodash";
import { observer } from "mobx-react-lite";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";

type IProps = {
  style?: any;
  className?: any;
  onBottom: () => void;
  children: any;
};

export type ScrollAreaHandles = {
  scrollToBottom: () => void;
}

export const ScrollArea = observer(forwardRef<ScrollAreaHandles, IProps>(({ style, className, children, onBottom }, ref) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtTop, setIsAtTop] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const controls = useAnimation();

  const debounceBottom = _.debounce(onBottom!, 500, { leading: true, trailing: false });

  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
    },
  }));

  const handleScroll = (e) => {
    const target = e.target;
    const bottom = (target.scrollHeight - target.scrollTop) <= target.clientHeight + 100;
    const top = target.scrollTop <= 100;

    if (bottom) {
      debounceBottom();
      if (!isAtBottom) {
        setIsAtBottom(true);
        controls.start({ y: [-10, 0], transition: { type: "spring", stiffness: 300 } });
      }
    } else {
      setIsAtBottom(false);
    }

    if (top) {
      if (!isAtTop) {
        setIsAtTop(true);
        controls.start({ y: [10, 0], transition: { type: "spring", stiffness: 300 } });
      }
    } else {
      setIsAtTop(false);
    }
  };

  useEffect(() => {
    const divElement = scrollRef.current;
    divElement!.addEventListener("scroll", handleScroll);
    return () => {
      divElement!.removeEventListener("scroll", handleScroll);
    };
  }, [isAtTop, isAtBottom]);

  return (
    <motion.div
      ref={scrollRef}
      style={style}
      className={`${className} overflow-y-scroll`}
      animate={controls}
    >
      {children}
    </motion.div>
  );
}))