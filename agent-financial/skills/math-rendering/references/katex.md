# KaTeX math in the chat

The installed frontend pipeline is `remark-math` 6 and `rehype-katex` 7 with
KaTeX 0.16.22. Accepted delimiters are `$...$` and `$$...$$`; the existing
`normalizeMathDelimiters` function translates common `\(...\)` and `\[...\]`
input before parsing. Avoid mixing delimiters or placing display delimiters in
the middle of a paragraph.

KaTeX supports a large documented subset of TeX, not arbitrary LaTeX packages,
custom macros, or every environment. Confirm commands against
[supported functions](https://katex.org/docs/supported.html). `aligned`,
`matrix`, `bmatrix`, `cases`, fractions, roots, sums, products, subscripts and
superscripts are suitable. `\text{}` is useful for units and labels.

## Financial examples

```md
$$FV = PV(1+i)^n$$

$$PMT = PV\frac{i(1+i)^n}{(1+i)^n-1}$$

$$\begin{aligned}
J &= C \cdot i \cdot n \\
M &= C + J
\end{aligned}$$
```

Frequent failures: unsupported commands such as package-specific macros,
unescaped `_` or `%` in text, missing braces, mismatched `\begin`/`\end`, and
using `\displaystyle` where plain display math already gives display style.
Delimiter validation only detects likely boundary mistakes; actual KaTeX parsing
is covered by the frontend JavaScript tests.
