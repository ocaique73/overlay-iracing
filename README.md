# Overlay iRacing

Overlays para iRacing em português (também inglês e espanhol): classificação, relative, radar, delta, setores,
bandeiras, incidentes, limitador do pit, pneus, combustível, log de voltas e FPS.

## Baixar

Baixe o instalador **Overlay-iRacing-Setup-x.y.z.exe** na página de [Releases](../../releases/latest).
Depois de instalado, o próprio app avisa quando sai versão nova: é só clicar em **Atualizar**.

> O Windows pode mostrar "O Windows protegeu o computador" na primeira instalação porque o app não tem
> assinatura digital. Clique em **Mais informações → Executar assim mesmo**.

## Desenvolvimento

```
npm install
npm start          # roda o app
npm run dist       # gera o instalador em dist/
```

Para publicar uma versão: suba o número em `package.json`, faça commit e envie a tag `vX.Y.Z`.
O GitHub Actions gera o instalador e publica o release.
