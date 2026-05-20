import React from 'react';
import AnimatedIcon from './AnimatedIcon';

const TelegramPostRenderer = ({
  text,
  entities,
  style = {},
  staticEmoji = false,
  showCard = false,
  mediaPreview = null,
  buttonText = null,
  link = null
}) => {
  // If invalid text, just don't render or render empty?
  const hasContent = text || mediaPreview;
  if (!hasContent) return null;

  const baseStyle = {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontSize: '15px',
    lineHeight: '1.5',
    color: '#ccc',
    ...style
  };

  const renderTextContent = () => {
    if (!text) return null;
    if (!entities || entities.length === 0) {
      return <span style={baseStyle}>{text}</span>;
    }

    const boundaries = new Set([0, text.length]);
    entities.forEach(e => {
      boundaries.add(e.offset);
      boundaries.add(e.offset + e.length);
    });

    const sortedPoints = Array.from(boundaries).sort((a, b) => a - b);
    const result = [];

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const start = sortedPoints[i];
      const end = sortedPoints[i + 1];
      if (start >= end) continue;

      let content = text.slice(start, end);
      const activeEntities = entities.filter(e => start >= e.offset && end <= (e.offset + e.length));
      const emojiEntity = activeEntities.find(e => e.type === 'custom_emoji');

      if (emojiEntity) {
        content = (
          <span key={`emoji-${i}`} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 1px' }}>
            <AnimatedIcon
              emojiId={emojiEntity.document_id || emojiEntity.custom_emoji_id}
              size={parseInt(baseStyle.fontSize) + 4 || 20}
              loop={!staticEmoji}
              staticMode={staticEmoji}
            />
          </span>
        );
      }

      let wrapped = content;
      if (activeEntities.some(e => e.type === 'bold')) wrapped = <strong key={`bold-${i}`}>{wrapped}</strong>;
      if (activeEntities.some(e => e.type === 'italic')) wrapped = <em key={`italic-${i}`}>{wrapped}</em>;

      const linkEntity = activeEntities.find(e => e.type === 'text_link' || e.type === 'url');
      if (linkEntity) {
        wrapped = (
          <a key={`link-${i}`} href={linkEntity.url} target="_blank" rel="noopener noreferrer" style={{ color: '#7B68EE' }}>
            {wrapped}
          </a>
        );
      }

      result.push(<React.Fragment key={i}>{wrapped}</React.Fragment>);
    }
    return <span style={baseStyle}>{result}</span>;
  };

  const content = renderTextContent();

  if (showCard) {
    return (
      <div style={{
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '12px',
        margin: '8px 0',
        background: 'rgba(0,0,0,0.3)'
      }}>
        {mediaPreview && (
          <img
            src={mediaPreview}
            style={{
              width: '100%',
              borderRadius: '8px',
              marginBottom: '8px',
              maxHeight: '200px',
              objectFit: 'cover'
            }}
            alt="Post Media"
          />
        )}
        <div>
          {content}
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 0',
                textAlign: 'center',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: '600',
                marginTop: '12px',
                fontSize: '14px'
              }}
            >
              {buttonText || 'View'}
            </a>
          )}
        </div>
      </div>
    );
  }

  return content;
};

export default TelegramPostRenderer;