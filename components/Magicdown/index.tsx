import { useMemo, useState, memo } from 'react'
import Markdown, { type Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import copy from 'copy-to-clipboard'
import { Copy, CopyCheck } from 'lucide-react'
import Mermaid from './Mermaid'
import Button from '@/components/Button'
import { langAlias } from '@/constant/highlight'
import { clsx } from 'clsx'
import { omit, capitalize, get, isNumber } from 'lodash-es'

import './style.css'
import 'katex/dist/katex.min.css'

function getLangAlias(lang: string): string {
  return get(langAlias, lang, capitalize(lang))
}

function Magicdown({ children: content, className, ...rest }: Options) {
  const [waitingCopy, setWaitingCopy] = useState<boolean>(false)
  const remarkPlugins = useMemo(() => rest.remarkPlugins ?? [], [rest.remarkPlugins])
  const rehypePlugins = useMemo(() => rest.rehypePlugins ?? [], [rest.rehypePlugins])
  const components = useMemo(() => rest.components ?? {}, [rest.components])

  const handleCopy = (start: number | undefined, end: number | undefined) => {
    if (content && isNumber(start) && isNumber(end)) {
      setWaitingCopy(true)
      copy(content.substring(start, end))
      setTimeout(() => {
        setWaitingCopy(false)
      }, 1200)
    }
  }

  return (
    <Markdown
      {...rest}
      className={clsx('markdown', className)}
      remarkPlugins={[remarkGfm, remarkMath, ...remarkPlugins]}
      rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }], rehypeKatex, ...rehypePlugins]}
      components={{
        pre: (props) => {
          const { children, className, ...rest } = props
          return (
            <pre {...omit(rest, ['node'])} className={clsx('my-4', className)}>
              {children}
            </pre>
          )
        },
        code: (props) => {
          const { children, className, node, ...rest } = props
          if (className?.includes('hljs')) {
            const lang = /language-(\w+)/.exec(className || '')
            if (lang && lang[1] === 'mermaid') {
              return <Mermaid>{children}</Mermaid>
            }
            return (
              <>
                <div className="flex h-10 w-full items-center justify-between overflow-x-auto break-words rounded-t bg-gray-200 pl-4 pr-3 text-sm text-slate-500 dark:bg-[rgb(31,41,55)]">
                  {lang ? <span title={lang[1]}>{getLangAlias(lang[1])}</span> : null}
                  <Button
                    className="h-6 w-6 rounded-sm p-1 dark:hover:bg-slate-900/80"
                    variant="ghost"
                    title="Copy"
                    onClick={() => handleCopy(node?.position?.start.offset, node?.position?.end.offset)}
                  >
                    {waitingCopy ? (
                      <CopyCheck className="h-full w-full text-green-500" />
                    ) : (
                      <Copy className="h-full w-full" />
                    )}
                  </Button>
                </div>
                <code {...rest} className={clsx('rounded-b', className)}>
                  {children}
                </code>
              </>
            )
          } else {
            return (
              <code {...rest} className={className}>
                {children}
              </code>
            )
          }
        },
        a: (props) => {
          const { children, href = '', target, ...rest } = props
          if (/\.(aac|mp3|opus|wav)$/.test(href)) {
            return (
              <figure>
                <audio controls src={href}></audio>
              </figure>
            )
          }
          if (/\.(3gp|3g2|webm|ogv|mpeg|mp4|avi)$/.test(href)) {
            return (
              <video controls width="99.9%">
                <source src={href} />
              </video>
            )
          }
          const isInternal = /^\/#/i.test(href)
          return (
            <a {...omit(rest, ['node'])} href={href} target={isInternal ? '_self' : target ?? '_blank'}>
              {children}
            </a>
          )
        },
        ...components,
      }}
    >
      {content}
    </Markdown>
  )
}

export default memo(Magicdown)
