import React, { useRef, useEffect, useState } from 'react';
import { Download, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';

export default function ChartCanvas({ imageUrl, overlayData, showOverlays = true }) {
  const canvasRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [overlaysVisible, setOverlaysVisible] = useState(showOverlays);
  const imageRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      drawChart();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (imageLoaded) {
      drawChart();
    }
  }, [overlaysVisible, overlayData, imageLoaded]);

  const drawChart = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match image
    canvas.width = img.width;
    canvas.height = img.height;

    // Draw the base chart image
    ctx.drawImage(img, 0, 0);

    if (!overlaysVisible || !overlayData) return;

    const scaleX = img.width / 800;
    const scaleY = img.height / 600;

    // Draw support zones (green horizontal lines)
    if (overlayData.support_zones) {
      overlayData.support_zones.forEach(zone => {
        const y = zone.y * scaleY;
        const strength = zone.strength || 'medium';
        const alpha = strength === 'strong' ? 0.8 : strength === 'medium' ? 0.6 : 0.4;
        
        // Draw zone rectangle
        ctx.fillStyle = `rgba(34, 197, 94, ${alpha * 0.15})`;
        ctx.fillRect(0, y - 10, canvas.width, 20);
        
        // Draw line
        ctx.strokeStyle = `rgba(34, 197, 94, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw label
        ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
        ctx.fillRect(10, y - 25, ctx.measureText(zone.label).width + 16, 22);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillText(zone.label, 18, y - 10);
      });
    }

    // Draw resistance zones (red horizontal lines)
    if (overlayData.resistance_zones) {
      overlayData.resistance_zones.forEach(zone => {
        const y = zone.y * scaleY;
        const strength = zone.strength || 'medium';
        const alpha = strength === 'strong' ? 0.8 : strength === 'medium' ? 0.6 : 0.4;
        
        // Draw zone rectangle
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.15})`;
        ctx.fillRect(0, y - 10, canvas.width, 20);
        
        // Draw line
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw label
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.fillRect(10, y + 5, ctx.measureText(zone.label).width + 16, 22);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillText(zone.label, 18, y + 19);
      });
    }

    // Draw trendlines
    if (overlayData.trendlines) {
      overlayData.trendlines.forEach(line => {
        const x1 = line.x1 * scaleX;
        const y1 = line.y1 * scaleY;
        const x2 = line.x2 * scaleX;
        const y2 = line.y2 * scaleY;
        const color = line.type === 'bullish' ? 'rgba(59, 130, 246, 0.8)' : 'rgba(249, 115, 22, 0.8)';

        // Draw trendline
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Draw arrow at the end
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowSize = 12;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - arrowSize * Math.cos(angle - Math.PI / 6), y2 - arrowSize * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - arrowSize * Math.cos(angle + Math.PI / 6), y2 - arrowSize * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();

        // Draw label
        if (line.label) {
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          ctx.fillStyle = color;
          ctx.fillRect(midX - 50, midY - 12, 100, 20);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(line.label, midX, midY + 3);
          ctx.textAlign = 'left';
        }
      });
    }

    // Draw chart patterns (including complex patterns like H&S, Triangles, Flags, Wedges)
    if (overlayData.patterns) {
      overlayData.patterns.forEach(pattern => {
        const patternType = pattern.type || pattern.name?.toLowerCase() || '';
        let color = pattern.breakout_direction === 'bullish' ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)';
        let fillColor = pattern.breakout_direction === 'bullish' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
        
        // Special colors for specific pattern types
        if (patternType.includes('head') || patternType.includes('h&s')) {
          color = 'rgba(168, 85, 247, 0.8)';
          fillColor = 'rgba(168, 85, 247, 0.1)';
        } else if (patternType.includes('triangle')) {
          color = 'rgba(59, 130, 246, 0.8)';
          fillColor = 'rgba(59, 130, 246, 0.1)';
        } else if (patternType.includes('wedge')) {
          color = 'rgba(249, 115, 22, 0.8)';
          fillColor = 'rgba(249, 115, 22, 0.1)';
        } else if (patternType.includes('flag') || patternType.includes('pennant')) {
          color = 'rgba(236, 72, 153, 0.8)';
          fillColor = 'rgba(236, 72, 153, 0.1)';
        } else if (patternType.includes('double') || patternType.includes('triple')) {
          color = 'rgba(255, 214, 10, 0.8)';
          fillColor = 'rgba(255, 214, 10, 0.1)';
        } else if (patternType.includes('cup') || patternType.includes('handle')) {
          color = 'rgba(0, 217, 245, 0.8)';
          fillColor = 'rgba(0, 217, 245, 0.1)';
        }
        
        if (pattern.points && pattern.points.length > 0) {
          const scaledPoints = pattern.points.map(([x, y]) => [x * scaleX, y * scaleY]);
          
          // Fill the pattern area
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.moveTo(scaledPoints[0][0], scaledPoints[0][1]);
          for (let i = 1; i < scaledPoints.length; i++) {
            ctx.lineTo(scaledPoints[i][0], scaledPoints[i][1]);
          }
          ctx.closePath();
          ctx.fill();
          
          // Draw pattern outline
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 3]);
          ctx.beginPath();
          ctx.moveTo(scaledPoints[0][0], scaledPoints[0][1]);
          for (let i = 1; i < scaledPoints.length; i++) {
            ctx.lineTo(scaledPoints[i][0], scaledPoints[i][1]);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw pattern name with enhanced styling
          const centerX = scaledPoints.reduce((sum, p) => sum + p[0], 0) / scaledPoints.length;
          const centerY = scaledPoints.reduce((sum, p) => sum + p[1], 0) / scaledPoints.length;
          const labelWidth = ctx.measureText(pattern.name).width + 20;
          
          // Label background with rounded corners
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(centerX - labelWidth/2, centerY - 14, labelWidth, 26, 6);
          ctx.fill();
          
          // Label text
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(pattern.name, centerX, centerY + 4);
          ctx.textAlign = 'left';
          
          // Draw key points markers for complex patterns
          if (pattern.key_points) {
            pattern.key_points.forEach((point, idx) => {
              const px = point.x * scaleX;
              const py = point.y * scaleY;
              
              // Draw point marker
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(px, py, 6, 0, 2 * Math.PI);
              ctx.fill();
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 2;
              ctx.stroke();
              
              // Draw point label
              if (point.label) {
                ctx.fillStyle = 'rgba(0,0,0,0.8)';
                ctx.fillRect(px + 8, py - 10, ctx.measureText(point.label).width + 10, 18);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.fillText(point.label, px + 13, py + 3);
              }
            });
          }
        }
        
        // Draw neckline for H&S patterns
        if (pattern.neckline) {
          const nl = pattern.neckline;
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.9)';
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 5]);
          ctx.beginPath();
          ctx.moveTo(nl.x1 * scaleX, nl.y1 * scaleY);
          ctx.lineTo(nl.x2 * scaleX, nl.y2 * scaleY);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Neckline label
          const midX = (nl.x1 + nl.x2) / 2 * scaleX;
          const midY = (nl.y1 + nl.y2) / 2 * scaleY;
          ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
          ctx.fillRect(midX - 35, midY - 10, 70, 18);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Neckline', midX, midY + 3);
          ctx.textAlign = 'left';
        }
        
        // Draw target projection
        if (pattern.target) {
          const tgt = pattern.target;
          ctx.strokeStyle = 'rgba(0, 245, 160, 0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(tgt.x * scaleX, tgt.y * scaleY);
          ctx.lineTo(tgt.x * scaleX + 100, tgt.y * scaleY);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Target arrow
          ctx.fillStyle = 'rgba(0, 245, 160, 0.9)';
          ctx.beginPath();
          ctx.moveTo(tgt.x * scaleX + 100, tgt.y * scaleY);
          ctx.lineTo(tgt.x * scaleX + 90, tgt.y * scaleY - 5);
          ctx.lineTo(tgt.x * scaleX + 90, tgt.y * scaleY + 5);
          ctx.closePath();
          ctx.fill();
          
          // Target label
          ctx.fillStyle = 'rgba(0, 245, 160, 0.95)';
          ctx.fillRect(tgt.x * scaleX + 105, tgt.y * scaleY - 10, 80, 20);
          ctx.fillStyle = '#000';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(`Target: ${tgt.price || ''}`, tgt.x * scaleX + 110, tgt.y * scaleY + 4);
        }
      });
    }

    // Draw entry markers
    if (overlayData.entry_markers) {
      overlayData.entry_markers.forEach(marker => {
        const x = marker.x * scaleX;
        const y = marker.y * scaleY;
        
        // Draw circle
        ctx.fillStyle = 'rgba(0, 245, 160, 0.9)';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw label
        ctx.fillStyle = 'rgba(0, 245, 160, 0.95)';
        ctx.fillRect(x + 12, y - 12, ctx.measureText(marker.label).width + 12, 22);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillText(marker.label, x + 18, y + 3);
      });
    }

    // Draw stop loss markers
    if (overlayData.stop_loss_markers) {
      overlayData.stop_loss_markers.forEach(marker => {
        const x = marker.x * scaleX;
        const y = marker.y * scaleY;
        
        // Draw X marker
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.lineWidth = 3;
        const size = 8;
        ctx.beginPath();
        ctx.moveTo(x - size, y - size);
        ctx.lineTo(x + size, y + size);
        ctx.moveTo(x + size, y - size);
        ctx.lineTo(x - size, y + size);
        ctx.stroke();

        // Draw label
        ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
        ctx.fillRect(x + 12, y - 12, ctx.measureText(marker.label).width + 12, 22);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillText(marker.label, x + 18, y + 3);
      });
    }

    // Draw take profit markers
    if (overlayData.take_profit_markers) {
      overlayData.take_profit_markers.forEach((marker, idx) => {
        const x = marker.x * scaleX;
        const y = marker.y * scaleY;
        const colors = ['rgba(0, 217, 245, 0.9)', 'rgba(168, 85, 247, 0.9)', 'rgba(255, 214, 10, 0.9)'];
        const color = colors[idx] || colors[0];
        
        // Draw triangle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x - 7, y + 6);
        ctx.lineTo(x + 7, y + 6);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw label
        ctx.fillStyle = color;
        ctx.fillRect(x + 12, y - 12, ctx.measureText(marker.label).width + 12, 22);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillText(marker.label, x + 18, y + 3);
      });
    }

    // Draw breakout zones
    if (overlayData.breakout_zones) {
      overlayData.breakout_zones.forEach(zone => {
        const x = zone.x * scaleX;
        const y = zone.y * scaleY;
        const width = zone.width * scaleX;
        const height = zone.height * scaleY;
        const color = zone.type === 'bullish' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)';
        
        // Draw zone
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
        
        // Draw border
        ctx.strokeStyle = zone.type === 'bullish' ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);

        // Draw label
        if (zone.label) {
          ctx.fillStyle = zone.type === 'bullish' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)';
          ctx.fillRect(x + 5, y + 5, ctx.measureText(zone.label).width + 12, 20);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(zone.label, x + 11, y + 18);
        }
      });
    }

    // Draw liquidity sweeps
    if (overlayData.liquidity_sweeps) {
      overlayData.liquidity_sweeps.forEach(sweep => {
        const x = sweep.x * scaleX;
        const y = sweep.y * scaleY;
        
        // Draw sweep marker (lightning bolt style)
        ctx.fillStyle = 'rgba(255, 214, 10, 0.9)';
        ctx.beginPath();
        ctx.moveTo(x, y - 12);
        ctx.lineTo(x - 6, y);
        ctx.lineTo(x + 2, y);
        ctx.lineTo(x - 2, y + 12);
        ctx.lineTo(x + 6, y);
        ctx.lineTo(x - 2, y);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw label
        if (sweep.label) {
          ctx.fillStyle = 'rgba(255, 214, 10, 0.95)';
          ctx.fillRect(x + 12, y - 10, ctx.measureText(sweep.label).width + 12, 20);
          ctx.fillStyle = '#000';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(sweep.label, x + 18, y + 3);
        }
      });
    }
    
    // Draw order blocks
    if (overlayData.order_blocks) {
      overlayData.order_blocks.forEach(ob => {
        const x = ob.x * scaleX;
        const y = ob.y * scaleY;
        const width = (ob.width || 80) * scaleX;
        const height = (ob.height || 40) * scaleY;
        const isBullish = ob.type === 'bullish';
        const color = isBullish ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';
        const borderColor = isBullish ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
        
        // Draw order block rectangle with gradient
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
        
        // Draw border
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        
        // Draw diagonal lines pattern
        ctx.strokeStyle = isBullish ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < width + height; i += 10) {
          ctx.beginPath();
          ctx.moveTo(x + Math.min(i, width), y + Math.max(0, i - width));
          ctx.lineTo(x + Math.max(0, i - height), y + Math.min(i, height));
          ctx.stroke();
        }
        
        // Draw label
        if (ob.label) {
          ctx.fillStyle = borderColor;
          ctx.fillRect(x + 2, y + 2, ctx.measureText(ob.label).width + 10, 16);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px Inter, sans-serif';
          ctx.fillText(ob.label, x + 7, y + 13);
        }
      });
    }
    
    // Draw fair value gaps (FVGs)
    if (overlayData.fair_value_gaps) {
      overlayData.fair_value_gaps.forEach(fvg => {
        const x = fvg.x * scaleX;
        const y = fvg.y * scaleY;
        const width = (fvg.width || 60) * scaleX;
        const height = (fvg.height || 30) * scaleY;
        const isBullish = fvg.type === 'bullish';
        const color = isBullish ? 'rgba(0, 217, 245, 0.25)' : 'rgba(168, 85, 247, 0.25)';
        const borderColor = isBullish ? 'rgba(0, 217, 245, 0.8)' : 'rgba(168, 85, 247, 0.8)';
        
        // Draw FVG rectangle
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width, height);
        
        // Draw dashed border
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
        
        // Draw label
        if (fvg.label) {
          ctx.fillStyle = borderColor;
          ctx.fillRect(x + width/2 - 15, y + height/2 - 8, 30, 16);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 9px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(fvg.label, x + width/2, y + height/2 + 4);
          ctx.textAlign = 'left';
        }
      });
    }
  };

  const downloadChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `chart-analysis-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-end gap-2 mb-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOverlaysVisible(!overlaysVisible)}
          className="bg-[#0B0E11] border-[#2A2F3A] text-slate-300 hover:text-white"
        >
          {overlaysVisible ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
          {overlaysVisible ? 'Hide' : 'Show'} Overlays
        </Button>
        <Button
          size="sm"
          onClick={downloadChart}
          className="bg-[#00F5A0] text-black hover:bg-[#00D9F5] font-bold"
        >
          <Download className="w-4 h-4 mr-1" />
          Download
        </Button>
      </div>
      <div className="relative rounded-lg overflow-hidden border border-[#2A2F3A] shadow-lg">
        <canvas
          ref={canvasRef}
          className="w-full h-auto"
          style={{ display: 'block', maxWidth: '100%' }}
        />
      </div>
    </div>
  );
}
