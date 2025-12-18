Uso do ImageLightbox

O componente `ImageLightboxProvider` fornece um modal reutilizável para ampliar imagens em páginas de leitura (capítulos, posts, personagens, codex, localização etc.).

Hook

- useImageLightbox().open(src, alt?, originEl?)
  - src: URL da imagem
  - alt: texto alternativo (opcional)
  - originEl: elemento HTML (opcional). Se fornecido, o provedor tentará detectar outras imagens no mesmo container (por exemplo, dentro do mesmo `article` ou `.prose`) e criar uma galeria navegável com ← / →.

- useImageLightbox().close()

Helper global (conteúdo injetado)

Quando o conteúdo é renderizado via `dangerouslySetInnerHTML` (HTML vindo do editor), não é possível usar hooks diretamente. O provedor expõe globalmente uma função:

- `window.__openImageLightbox(src, alt?, el?)`
  - `el` é o elemento `HTMLImageElement` clicado. Se possível, passe o elemento para que o provedor possa detectar a galeria.

Exemplos

- Em JSX (p.ex. `character.tsx`):

```tsx
const { open } = useImageLightbox();

<img src={character.imageUrl} alt={character.name} onClick={(e) => { const el = e.currentTarget as HTMLImageElement; open(character.imageUrl, character.name, el); }} />
```

- Em HTML injetado (conteúdo do editor):

No click handler que envolve o `dangerouslySetInnerHTML`:

```tsx
const onClick = (e) => {
  const target = e.target as HTMLElement;
  if (target && target.tagName === 'IMG') {
    const img = target as HTMLImageElement;
    (window as any).__openImageLightbox(img.src, img.alt || '', img);
  }
};
```

Comportamento

- Foco acessível: ao abrir, o foco é movido para o botão de fechar; ao fechar, o foco é restaurado ao elemento que tinha foco antes da abertura.
- Galeria: se houver mais de uma imagem no mesmo container (article/.prose/etc.), miniaturas aparecem embaixo e você pode navegar com as teclas ← / → ou clicando nelas.
- Fechar: X no canto, clicar fora ou tecla Esc.
- Zoom e Pan:
  - Scroll do mouse: aumenta/diminui (travado entre 1x e 4x).
  - Duplo clique: alterna entre 1x e 2x.
  - Arrastar (hold + mover) quando ampliado para mover a área visível.
  - Teclado: `+` ou `=` aumenta, `-` diminui, `0` reseta.
  - Botões flutuantes (+, −, Reset) abaixo da imagem do lado direito.
- Reset automático de zoom ao trocar de imagem.

Styling rápido

- Backdrop escuro com blur (`bg-black/85 backdrop-blur-md`).
- Container da imagem com borda leve, sombra e transição de transform.
- Miniaturas dentro de uma faixa semitransparente com blur.

Customização

Você pode ajustar classes Tailwind diretamente em `image-lightbox.tsx`:
- Intensidade do fundo: altere `bg-black/85`.
- Limite de zoom: ajuste função `clampScale`.
- Transição: modifique `transition-transform duration-200 ease-out`.
- Miniaturas: editar classes no bloco que constrói `<img src={u} ... />` dentro da faixa.

Acessibilidade extra (possíveis melhorias futuras)
- Foco-trap dentro do modal (não implementado ainda).
- Anunciar zoom via `aria-live` (não implementado).

Observações

- Evite ativar o lightbox em páginas que apenas listam cards (ex.: página `world`) para não quebrar o comportamento de navegação ao clicar no card; aplique somente nas páginas de leitura.
- Se suas imagens usam `data-src` ou lazy-loading, adapte a coleta da galeria para usar esses atributos.

