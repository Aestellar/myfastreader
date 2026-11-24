import React from 'react';
import { Fb2Book, xlinkHref } from '../lib/fb2';

function renderChildren(node: Node, book: Fb2Book, kp: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  for (const child of Array.from(node.childNodes)) {
    const key = `${kp}${i++}`;
    if (child.nodeType === Node.TEXT_NODE) {
      out.push(<React.Fragment key={key}>{child.textContent}</React.Fragment>);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      out.push(renderElement(child as Element, book, key));
    }
  }
  return out;
}

function renderElement(el: Element, book: Fb2Book, key: string): React.ReactNode {
  const tag = el.localName.toLowerCase();
  const kids = () => renderChildren(el, book, key + '-');

  switch (tag) {
    case 'p':            return <p key={key}>{kids()}</p>;
    case 'title':        return <h2 key={key} className="fb2-title">{kids()}</h2>;
    case 'subtitle':     return <h3 key={key} className="fb2-subtitle">{kids()}</h3>;
    case 'empty-line':   return <div key={key} className="fb2-empty-line" />;
    case 'emphasis':     return <em key={key}>{kids()}</em>;
    case 'strong':       return <strong key={key}>{kids()}</strong>;
    case 'strikethrough':return <s key={key}>{kids()}</s>;
    case 'sub':          return <sub key={key}>{kids()}</sub>;
    case 'sup':          return <sup key={key}>{kids()}</sup>;
    case 'code':         return <code key={key}>{kids()}</code>;
    case 'a':            return <span key={key} className="fb2-link">{kids()}</span>;
    case 'date':         return <span key={key} className="fb2-date">{kids()}</span>;
    case 'epigraph':     return <blockquote key={key} className="fb2-epigraph">{kids()}</blockquote>;
    case 'cite':         return <blockquote key={key} className="fb2-cite">{kids()}</blockquote>;
    case 'text-author':  return <div key={key} className="fb2-text-author">{kids()}</div>;
    case 'poem':         return <div key={key} className="fb2-poem">{kids()}</div>;
    case 'stanza':       return <div key={key} className="fb2-stanza">{kids()}</div>;
    case 'v':            return <div key={key} className="fb2-verse-line">{kids()}</div>;
    case 'section':      return <section key={key} className="fb2-section">{kids()}</section>;
    case 'image': {
      const href = xlinkHref(el);
      const id = href?.replace(/^#/, '');
      const src = id ? book.images.get(id) : undefined;
      return src
        ? <img key={key} src={src} alt="" className="fb2-image" />
        : <span key={key} className="fb2-image-missing">[изображение]</span>;
    }
    default:
      return <span key={key} data-tag={tag}>{kids()}</span>;
  }
}

export function Fb2View({ book }: { book: Fb2Book }) {
  const bodies = Array.from(book.xml.getElementsByTagName('body'));
  return (
    <div className="fb2-view">
      {bodies.map((body, i) => (
        <article key={i}>{renderChildren(body, book, `b${i}-`)}</article>
      ))}
    </div>
  );
}