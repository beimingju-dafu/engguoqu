# 不规则动词快背

按教材里的 IRREGULAR VERBS 表，把 66 个不规则动词分成 9 组来背。先看卡片，再测验刚看过的词。进度存在这台设备的浏览器里。

## 开始

```bash
npm install
npm run dev
```

浏览器打开终端里的本地地址。手机宽度直接用就行。

不想装环境的话，直接用浏览器打开仓库里的 [engguoqu.html](./engguoqu.html)。这一个文件里已经带上了样式、脚本和词表，双击就能背。需要联网时才会去加载字体；离线也能用，只是字形会换成系统字体。

```bash
npm test
npm run build
```

## 怎么分组

不按字母排，按写法排。同一组的变化一样，放在一起记：

1. **三个都一样**：cost / cost / cost。read 写法不变，读音从 /riːd/ 变成 /red/。can 只有 could，没有过去分词。
2. **ought / aught**：过去式和过去分词相同，像 bring / bought / bought。
3. **词尾收成 t**：keep / kept / kept。
4. **稍微改一下**：make / made / made。
5. **元音变成 ou / oo / o**：包括教材里的 get / got / got。
6. **i → a → u**：sing / sang / sung。
7. **ew → own**：know / knew / known。
8. **三个都变，多见 -en / -n**。lie 是「躺」：lie / lay / lain，不是「说谎」。
9. **没有规律，单独记**。be 的过去式写 was 或 were 都算对，过去分词是 been。

每组拆成大约 4 到 5 张卡片。看完一叠才能测验这一叠；整组看完可以再复习。答错的词进「复习错题」。

词形以教材为准，不改成美式（不用 gotten）。

## 页面

构建后的站点基址是 `/engguoqu/`，给 GitHub Pages 用：<https://beimingju-dafu.github.io/engguoqu/>
