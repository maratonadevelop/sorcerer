import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ImageLightboxProvider } from '@/components/image-lightbox';

function AppUnderTest() {
  return (
    <ImageLightboxProvider>
      <article>
        <img src="/img/a.jpg" alt="A" data-testid="img-a" />
        <p>Some text</p>
        <img src="/img/b.jpg" alt="B" data-testid="img-b" />
      </article>
    </ImageLightboxProvider>
  );
}

describe('ImageLightbox', () => {
  it('opens and closes', () => {
    render(<AppUnderTest />);
    const a = screen.getByTestId('img-a') as HTMLImageElement;
    // simulate click via global helper (what happens when content is injected)
    (window as any).__openImageLightbox?.(a.src, a.alt, a);
    // modal should be visible
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    // press Escape to close
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('navigates gallery with arrows', () => {
    render(<AppUnderTest />);
    const a = screen.getByTestId('img-a') as HTMLImageElement;
    const b = screen.getByTestId('img-b') as HTMLImageElement;
    (window as any).__openImageLightbox?.(a.src, a.alt, a);
    expect(screen.getByRole('dialog')).toBeTruthy();
    // press right arrow to go to next image
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    // the displayed image should now be b
    const shown = document.querySelector('img[alt="B"]') as HTMLImageElement | null;
    expect(shown).not.toBeNull();
    // prev
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    const shown2 = document.querySelector('img[alt="A"]') as HTMLImageElement | null;
    expect(shown2).not.toBeNull();
  });
});
