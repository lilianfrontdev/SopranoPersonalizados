# Personalizados Soprano

Páginas de campanha de personalizados + API de prévia com IA (OpenAI).

```
api/personalizar.js            API da prévia (POST /api/personalizar)
public/
  assets/                      Compartilhado entre campanhas
    js/simulador.js            Simulador (seleção de produto/cor, upload, IA)
    data/catalogo.json         Produtos, cores e imagens
    img/produtos/  img/marca/
  final-de-ano-2026/           Campanha atual → /final-de-ano-2026
    index.html
    style.css
    img/  catalogo-final-de-ano.pdf
vercel.json                    Redirecionamentos entre campanhas
```

## Nova campanha

1. Crie `public/<nova-campanha>/` com `index.html`, `style.css` e `img/`
   (dá para partir de uma cópia da campanha atual).
2. Mantenha no HTML a marcação do simulador (ids `#simulador`, `#selected-product`,
   `#color-options`, `#logo-input` etc.) e os cards `.product-card` com
   `data-family` igual ao `id` do produto em `catalogo.json`, e carregue
   `/assets/js/simulador.js`.
3. Em `vercel.json`, aponte a raiz para a nova campanha e redirecione a antiga:
   ```json
   "redirects": [
     { "source": "/", "destination": "/nova-campanha", "permanent": false },
     { "source": "/final-de-ano-2026", "destination": "/nova-campanha", "permanent": false }
   ]
   ```
   Os arquivos da campanha antiga podem ficar no repositório como histórico:
   ninguém chega mais neles, porque o redirecionamento é aplicado antes.
4. Commit e push. A Vercel publica.
