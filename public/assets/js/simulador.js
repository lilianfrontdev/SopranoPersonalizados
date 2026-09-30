const API_ENDPOINT = "/api/personalizar";
const CATALOGO_URL = "/assets/data/catalogo.json";
const TAMANHO_MAXIMO_LOGO = 10 * 1024 * 1024;

document.addEventListener("DOMContentLoaded", async () => {
  let catalogo;

  try {
    const resposta = await fetch(CATALOGO_URL);
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    catalogo = await resposta.json();
  } catch (erro) {
    console.error("Falha ao carregar o catálogo:", erro);
    document.querySelector("#upload-status").textContent =
      "Não foi possível carregar os produtos. Recarregue a página.";
    return;
  }

  const cards = [...document.querySelectorAll(".product-card")];
  const produto = document.querySelector("#selected-product");
  const nomeProduto = document.querySelector("#product-name");
  const opcoesCor = document.querySelector("#color-options");
  const inputLogo = document.querySelector("#logo-input");
  const previaLogo = document.querySelector("#logo-preview");
  const status = document.querySelector("#upload-status");
  const botaoGerar = document.querySelector("#generate-btn");
  const botaoBaixar = document.querySelector("#download-btn");
  const botaoAmpliar = document.querySelector("#expand-btn");
  const areaPrevia = document.querySelector("#preview-area");
  const modal = document.querySelector("#image-modal");
  const imagemModal = document.querySelector("#modal-image");
  const fecharModal = document.querySelector("#modal-close");
  const loader = document.querySelector("#ai-loader");
  const simulador = document.querySelector("#simulador");

  const cardInicial = cards.find((c) => c.getAttribute("aria-pressed") === "true") ?? cards[0];
  let familia = catalogo.find((f) => f.id === cardInicial.dataset.family);
  let variante = familia.variantes[0];
  let geracaoAtual = 0;

  const textoProduto = () => `${familia.nome} · ${variante.nome}`;

  function limparResultado(mensagem = "") {
    geracaoAtual++;
    restaurarBotaoGerar();
    produto.src = variante.imagem;
    produto.alt = textoProduto();
    previaLogo.hidden = !inputLogo.files[0];
    botaoBaixar.hidden = true;
    status.textContent = mensagem;
  }

  function restaurarBotaoGerar() {
    loader.hidden = true;
    botaoGerar.disabled = !inputLogo.files[0];
    botaoGerar.textContent = "Gerar prévia personalizada";
  }

  function renderizarCores() {
    opcoesCor.replaceChildren(
      ...familia.variantes.map((item) => {
        const botao = document.createElement("button");
        const bolinha = document.createElement("span");
        botao.type = "button";
        botao.className = "color-option";
        botao.setAttribute("aria-pressed", String(item.sku === variante.sku));
        bolinha.className = "color-dot";
        bolinha.style.background = item.cor;
        botao.append(bolinha, item.nome);
        botao.addEventListener("click", () => {
          variante = item;
          nomeProduto.textContent = textoProduto();
          renderizarCores();
          limparResultado(inputLogo.files[0] ? "Cor atualizada. Clique em gerar prévia." : "");
        });
        return botao;
      })
    );
  }

  function selecionarProduto(card) {
    cards.forEach((c) => c.setAttribute("aria-pressed", String(c === card)));
    familia = catalogo.find((f) => f.id === card.dataset.family);
    variante = familia.variantes[0];
    nomeProduto.textContent = textoProduto();
    renderizarCores();
    limparResultado(inputLogo.files[0] ? "Produto atualizado. Clique em gerar prévia." : "");
    simulador.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  cards.forEach((card) => card.addEventListener("click", () => selecionarProduto(card)));
  renderizarCores();

  inputLogo.addEventListener("change", () => {
    const arquivo = inputLogo.files[0];
    if (!arquivo) return;

    if (arquivo.size > TAMANHO_MAXIMO_LOGO) {
      inputLogo.value = "";
      limparResultado("O arquivo deve ter no máximo 10 MB.");
      return;
    }

    const leitor = new FileReader();
    leitor.onload = (e) => {
      previaLogo.src = e.target.result;
      limparResultado(`${arquivo.name} selecionado`);
    };
    leitor.readAsDataURL(arquivo);
  });

  function imagemOtimizada(origem, maximo = 1024, qualidade = 0.84) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, maximo / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", qualidade));
      };
      img.onerror = () => reject(new Error("Não foi possível preparar a imagem."));

      if (origem instanceof File) {
        const leitor = new FileReader();
        leitor.onload = () => (img.src = leitor.result);
        leitor.onerror = () => reject(new Error("Não foi possível ler a imagem."));
        leitor.readAsDataURL(origem);
      } else {
        img.src = origem;
      }
    });
  }

  botaoGerar.addEventListener("click", async () => {
    const arquivo = inputLogo.files[0];
    if (!arquivo) return;

    const geracao = ++geracaoAtual;
    const nomeGerado = `${familia.nome} ${variante.nome}`;

    botaoGerar.disabled = true;
    botaoGerar.textContent = "Aplicando logo...";
    loader.hidden = false;
    status.textContent = "A inteligência artificial está aplicando sua marca. Isso pode levar alguns instantes.";

    try {
      const [produtoPreparado, logoPreparada] = await Promise.all([
        imagemOtimizada(variante.imagem, 1024, 0.88),
        imagemOtimizada(arquivo, 1024, 0.9)
      ]);

      const resposta = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produto: produtoPreparado,
          logo: logoPreparada,
          nomeProduto: nomeGerado,
          tipoAplicacao: "serigrafia preferencialmente branca, respeitando a área frontal de personalização do produto"
        })
      });

      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok) {
        console.error("Resposta da API:", resposta.status, dados);
        throw new Error(dados.error || `Não foi possível gerar a prévia (erro ${resposta.status}).`);
      }
      if (!dados.image) {
        throw new Error("A API não retornou a imagem personalizada.");
      }

      if (geracao !== geracaoAtual) return;

      produto.src = dados.image;
      produto.alt = `Prévia de ${nomeGerado} com a logo aplicada`;
      previaLogo.hidden = true;
      botaoBaixar.hidden = false;
      status.textContent = "Prévia gerada com sucesso. Você pode ampliar ou baixar a imagem.";
    } catch (erro) {
      console.error("Falha na personalização:", erro);
      if (geracao === geracaoAtual) {
        status.textContent = erro.message || "Não foi possível gerar a prévia.";
      }
    } finally {
      if (geracao === geracaoAtual) restaurarBotaoGerar();
    }
  });

  function abrirModal() {
    imagemModal.src = produto.src;
    imagemModal.alt = produto.alt;
    modal.hidden = false;
    fecharModal.focus();
  }

  function fecharModalImagem() {
    modal.hidden = true;
    areaPrevia.focus();
  }

  areaPrevia.addEventListener("click", abrirModal);
  botaoAmpliar.addEventListener("click", abrirModal);
  fecharModal.addEventListener("click", fecharModalImagem);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) fecharModalImagem();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) fecharModalImagem();
  });

  botaoBaixar.addEventListener("click", () => {
    const nomeArquivo =
      `previa-${familia.nome}-${variante.nome}`
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") + ".png";

    const link = document.createElement("a");
    link.href = produto.src;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    status.textContent = "Download iniciado.";
  });
});
