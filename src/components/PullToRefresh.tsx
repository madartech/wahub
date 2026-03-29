import { useState, useRef, useCallback, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  threshold?: number;
}

export function PullToRefresh({ onRefresh, children, threshold = 80 }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only enable pull-to-refresh when scrolled to top
    const scrollParent = containerRef.current?.closest('main') || containerRef.current;
    if (scrollParent && scrollParent.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startYRef.current === null || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    // Only pull down, not up
    if (diff > 0) {
      // Apply resistance - the further you pull, the harder it gets
      const resistance = Math.min(diff * 0.5, threshold * 1.5);
      setPullDistance(resistance);
    }
  }, [isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (startYRef.current === null) return;

    startYRef.current = null;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold); // Hold at threshold during refresh
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);
  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div
      ref={containerRef}
      className="overscroll-none touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex justify-center items-center overflow-hidden transition-all duration-200"
        style={{
          height: showIndicator ? `${Math.max(pullDistance, isRefreshing ? 48 : 0)}px` : 0,
          opacity: showIndicator ? 1 : 0,
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            transform: `rotate(${progress * 360}deg)`,
            transition: isRefreshing ? 'none' : 'transform 0.1s',
          }}
        >
          <Loader2
            className={`h-6 w-6 text-primary ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </div>
      </div>

      {/* Content with transform for visual feedback */}
      <div
        style={{
          transform: pullDistance > 0 && !isRefreshing ? `translateY(${pullDistance * 0.1}px)` : 'none',
          transition: pullDistance === 0 ? 'transform 0.2s' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
