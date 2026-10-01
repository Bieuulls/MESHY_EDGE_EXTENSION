# 📦 MESHY_EDGE_EXTENSION

> Extensão moderna para Microsoft Edge e Google Chrome desenvolvida para varrer, identificar e baixar em lote todos os modelos 3D (`.GLB` e `.FBX`) do **[Meshy.ai](https://www.meshy.ai/)**, com detecção inteligente de animações e organização automática por pastas prontas para o **Blender**.

---

## ✨ Principais Recursos

- **📑 Varrer Todas as Páginas:** Navega automaticamente pelas páginas de ativos da sua conta Meshy (`1/3`, `2/3`, `3/3`), listando todos os modelos sem perder nenhum.
- **🏃 Detecção de Animação e Movimento:** Identifica modelos animados (`🏃 ANIMADO`) na galeria e separa as animações prontas para uso no Blender.
- **🎯 Focado no Blender (.GLB e .FBX):** Filtra apenas os formatos 3D que possuem malha, materiais, armatures e ossos de animação.
- **📁 Organização Automática em Subpastas:** Salva os downloads organizados na sua pasta padrão de Downloads em:
  - `Meshy_Blender/Modelos_Animados/` ➔ Animações de corrida, caminhada e movimentos.
  - `Meshy_Blender/Personagens_Texturizados/` ➔ Personagens com malha e texturas.
  - `Meshy_Blender/Modelos_Base/` ➔ Modelos brutos/clay.
- **🟢 HUD Flutuante Neon Integrado:** Widget flutuante moderno direto na interface do Meshy.ai com suporte a filtros, busca e download com 1 clique.
- **⚡ Botões Rápidos nos Cards (`⚡ DL`):** Baixe diretamente de qualquer card da grade do Meshy.
- **🛠️ Ferramenta de Fusão para Blender (`tools/merge_gltf.py`):** Script incluso para fundir animações glTF separadas em esqueletos de personagens sem distorcer nem danificar a malha.

---

## 🚀 Como Instalar no Microsoft Edge

1. Abra o Microsoft Edge e acesse:
   ```text
   edge://extensions/
   ```
2. No menu lateral inferior esquerdo, ative a opção **"Modo de desenvolvedor"** (*Developer mode*).
3. Clique no botão **"Carregar sem compactação"** (*Load unpacked*).
4. Selecione a pasta desta extensão:
   ```text
   D:\AUTO FLUXO VDEOS\MESHY_EDGE_EXTENSION
   ```
5. A extensão estará instalada e pronta para uso!

---

## 🎬 Como Usar no Meshy.ai

1. Abra o [Meshy.ai Workspace](https://www.meshy.ai/pt-BR/workspace).
2. O painel flutuante verde **📦 Meshy ➔ Blender Downloader** aparecerá no canto inferior direito.
3. Clique em **`📑 Varrer Páginas`** para ler todos os modelos da sua conta.
4. Clique em **`⚡ Baixar Tudo para o Blender`** ou use os botões individuais nos cards.

---

## 🛠️ Ferramenta de Fusão de Animação (Blender)

Caso o Meshy exporte a animação em um arquivo separado (`Animation_Running_withSkin.glb`) e o personagem em outro (`Character_output.glb`), use a ferramenta inclusa em `tools/`:

```bash
python tools/merge_gltf.py
```
Isso une a animação diretamente no esqueleto nativo do personagem, eliminando qualquer risco de distorção no Blender.

---

## 👤 Autor

Desenvolvido por **[Bieuulls](https://github.com/Bieuulls)**.
