import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import pako from 'pako';

const AnimatedIcon = ({ emojiId, size = 20, loop = false, staticMode = false }) => {
  const [animationData, setAnimationData] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    let objectUrl = null;

    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    const fetchAnimation = async () => {
      if (!emojiId) return;
      setAnimationData(null);
      setImageUrl(null);
      setError(false);

      try {
        const response = await fetch(`/api/admin/telegram-proxy/getFile?custom_emoji_id=${emojiId}`);
        if (!response.ok) throw new Error(`Failed to fetch emoji: ${response.status}`);

        const contentType = response.headers.get('Content-Type') || '';
        const arrayBuffer = await response.arrayBuffer();

        const bytes = new Uint8Array(arrayBuffer);
        const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
        const isWebp = bytes.length >= 12 &&
          bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
          bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;

        if (isWebp || contentType.includes('image/') || contentType.includes('webp')) {
          objectUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: contentType || 'image/webp' }));
          if (mounted) setImageUrl(objectUrl);
          return;
        }

        if (isGzip || contentType.includes('application/octet-stream') || contentType.includes('application/x-gzip') || contentType.includes('application/json')) {
          try {
            const inflated = pako.inflate(bytes, { to: 'string' });
            const json = JSON.parse(inflated);
            if (mounted) {
              setAnimationData(json);
              return;
            }
          } catch (_tgsError) {
            console.warn('Emoji file is not TGS or failed to decode; trying to treat as image fallback', _tgsError);
          }
        }

        // Fallback: render as image by blob, make sure browser can handle it
        if (mounted) {
          const fallbackType = (contentType && contentType !== 'application/octet-stream') ? contentType : (isWebp ? 'image/webp' : 'application/octet-stream');
          objectUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: fallbackType }));
          setImageUrl(objectUrl);
          return;
        }

      } catch (err) {
        console.error('Error loading animated icon:', err);
        if (mounted) setError(true);
      }
    };

    fetchAnimation();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [emojiId]);

  if (error) {
    return <span style={{ fontSize: size, lineHeight: 1 }}>💎</span>;
  }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt="custom emoji"
        style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle' }}
      />
    );
  }

  if (!animationData) {
    return (
      <div style={{
        width: size,
        height: size,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '50%',
        display: 'inline-block'
      }} />
    );
  }

  return (
    <div style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle' }}>
      <Lottie
        animationData={animationData}
        loop={loop && !staticMode}
        autoplay={!staticMode}
        style={{ width: '100%', height: '100%' }}
        rendererSettings={{
          preserveAspectRatio: 'xMidYMid slice',
          // Disable expressions to avoid eval usage
          runExpressions: false
        }}
      />
    </div>
  );
};

export default AnimatedIcon;