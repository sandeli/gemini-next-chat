'use client'
import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import { useTranslation } from 'react-i18next'
import Lightbox from 'yet-another-react-lightbox'
import LightboxFullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import {
  User,
  Bot,
  RotateCw,
  Copy,
  CopyCheck,
  PencilLine,
  Eraser,
  Volume2,
  Eye,
  LoaderCircle,
  CircleCheck,
  Blocks,
} from 'lucide-react'
import { EdgeSpeech } from '@xiangfa/polly'
import copy from 'copy-to-clipboard'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import Magicdown from '@/components/Magicdown'
import BubblesLoading from '@/components/BubblesLoading'
import FileList from '@/components/FileList'
import EditableArea from '@/components/EditableArea'
import AudioPlayer from '@/components/AudioPlayer'
import IconButton from '@/components/IconButton'
import Button from '@/components/Button'
import Weather, { type WeatherResult } from '@/components/plugins/Weather'
import Unsplash from '@/components/plugins/Unsplash'
import Arxiv from '@/components/plugins/Arxiv'
import { useMessageStore } from '@/store/chat'
import { useSettingStore } from '@/store/setting'
import { usePluginStore } from '@/store/plugin'
import AudioStream from '@/utils/AudioStream'
import { sentenceSegmentation } from '@/utils/common'
import { cn } from '@/utils'
import { OFFICAL_PLUGINS } from '@/plugins'
import { upperFirst, isFunction, find, findLastIndex, isUndefined } from 'lodash-es'

import 'katex/dist/katex.min.css'
import 'yet-another-react-lightbox/styles.css'

interface Props extends Message {
  onRegenerate?: (id: string) => void
}

function mergeSentences(sentences: string[], sentenceLength = 20): string[] {
  const mergedSentences: string[] = []
  let currentSentence = ''

  sentences.forEach((sentence) => {
    if (currentSentence.length + sentence.length >= sentenceLength) {
      mergedSentences.push(currentSentence.trim())
      currentSentence = sentence
    } else {
      currentSentence += ' ' + sentence
    }
  })

  if (currentSentence.trim() !== '') {
    mergedSentences.push(currentSentence.trim())
  }
  return mergedSentences
}

function MessageItem(props: Props) {
  const { id, role, parts, attachments, onRegenerate } = props
  const { t } = useTranslation()
  const [html, setHtml] = useState<string>('')
  const [thoughtsHtml, setThoughtsHtml] = useState<string>('')
  const chatLayout = useMessageStore((state) => state.chatLayout)
  const [hasTextContent, setHasTextContent] = useState<boolean>(false)
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [isCopyed, setIsCopyed] = useState<boolean>(false)
  const [showLightbox, setShowLightbox] = useState<boolean>(false)
  const [lightboxIndex, setLightboxIndex] = useState<number>(0)
  const fileList = useMemo(() => {
    return attachments ? attachments.filter((item) => !item.mimeType.startsWith('image/')) : []
  }, [attachments])
  const inlineImageList = useMemo(() => {
    const imageList: string[] = []
    parts.forEach(async (part) => {
      if (part.fileData && attachments) {
        for (const attachment of attachments) {
          if (attachment.metadata?.uri === part.fileData.fileUri) {
            if (part.fileData?.mimeType.startsWith('image/')) {
              if (attachment.dataUrl) imageList.push(attachment.dataUrl)
              if (attachment.preview) imageList.push(attachment.preview)
            }
          }
        }
      } else if (part.inlineData?.mimeType.startsWith('image/')) {
        imageList.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`)
      }
    })
    return imageList
  }, [parts, attachments])
  const inlineAudioList = useMemo(() => {
    const audioList: string[] = []
    parts.forEach(async (part) => {
      if (part.inlineData?.mimeType.startsWith('audio/')) {
        audioList.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`)
      }
    })
    return audioList
  }, [parts])
  const content = useMemo(() => {
    let text = ''
    parts.forEach((item) => {
      if (item.text) text = item.text
    })
    return text
  }, [parts])

  const handleRegenerate = useCallback(
    (id: string) => {
      if (isFunction(onRegenerate)) {
        onRegenerate(id)
      }
    },
    [onRegenerate],
  )

  const handleEdit = useCallback((id: string, content: string) => {
    const { messages, update } = useMessageStore.getState()
    const message = find(messages, { id })

    if (message) {
      const messageParts = [...message.parts]
      const textPartIndex = findLastIndex(messageParts, (item) => !isUndefined(item.text))
      if (textPartIndex !== -1) {
        messageParts[textPartIndex].text = content
      }
      update(id, { ...message, parts: messageParts })
    }

    setIsEditing(false)
  }, [])

  const handleDelete = useCallback((id: string) => {
    const { remove } = useMessageStore.getState()
    remove(id)
  }, [])

  const handleCopy = useCallback(() => {
    setIsCopyed(true)
    copy(content)
    setTimeout(() => {
      setIsCopyed(false)
    }, 1200)
  }, [content])

  const handleSpeak = useCallback(async (content: string) => {
    const { lang, ttsLang, ttsVoice } = useSettingStore.getState()
    const sentences = mergeSentences(sentenceSegmentation(content, lang), 100)
    const edgeSpeech = new EdgeSpeech({ locale: ttsLang })
    const audioStream = new AudioStream()

    for (const sentence of sentences) {
      const response = await edgeSpeech.create({
        input: sentence,
        options: { voice: ttsVoice },
      })
      if (response) {
        const audioData = await response.arrayBuffer()
        audioStream.play({ audioData })
      }
    }
  }, [])

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index)
    setShowLightbox(true)
  }, [])

  const MessageAvatar = () => {
    if (role === 'user') {
      return (
        <AvatarFallback className="bg-green-300 text-white">
          <User className="h-5 w-5" />
        </AvatarFallback>
      )
    } else if (role === 'function') {
      return (
        <AvatarFallback className="bg-blue-300 text-white">
          <Blocks className="h-5 w-5" />
        </AvatarFallback>
      )
    } else {
      return (
        <AvatarFallback className="bg-red-300 text-white">
          <Bot className="h-5 w-5" />
        </AvatarFallback>
      )
    }
  }

  const getPluginInfo = (name: string) => {
    const { installed } = usePluginStore.getState()
    const pluginId = name.split('__')[0]
    if (installed[pluginId]) return installed[pluginId]?.info
    return { title: pluginId, description: '' }
  }

  const MessageContent = () => {
    if (role === 'model' && parts && parts[0].text === '') {
      return <BubblesLoading />
    } else if (role === 'function' && parts && parts[0].functionResponse) {
      const pluginsDetail: {
        id: string
        title: string
        description?: string
        response?: FunctionResponse
      }[] = []
      for (const part of parts) {
        if (part.functionResponse) {
          const pluginInfo = getPluginInfo(part.functionResponse.name)
          pluginsDetail.push({
            id: part.functionResponse.name.split('__')[0],
            title: pluginInfo.title,
            description: pluginInfo.description,
            response: part.functionResponse.response as FunctionResponse,
          })
        }
      }
      return pluginsDetail.map((detail) => {
        return detail.response?.content ? (
          <div key={detail.id} className="w-full">
            <div className="mb-3">
              <Button variant="outline" title={detail.description}>
                {detail.title}
                <CircleCheck className="ml-1.5 h-5 w-5" />
              </Button>
            </div>
            {detail.id === OFFICAL_PLUGINS.WEATHER ? <Weather data={detail.response.content as WeatherResult} /> : null}
            {detail.id === OFFICAL_PLUGINS.UNSPLASH ? (
              <Unsplash data={detail.response.content as UnsplashImage[]} />
            ) : null}
            {detail.id === OFFICAL_PLUGINS.ARXIV ? (
              <Arxiv data={(detail.response.content as ArxivResult)?.data} />
            ) : null}
          </div>
        ) : (
          <div key={detail.id}>
            <div className="mb-3">
              <Button variant="outline" title={detail.description}>
                {detail.title}
                <LoaderCircle className="ml-1.5 h-5 w-5 animate-spin" />
              </Button>
            </div>
          </div>
        )
      })
    } else {
      return (
        <div className="group flex-auto overflow-x-auto">
          {fileList.length > 0 ? (
            <div className="not:last:border-dashed not:last:border-b w-full pb-2">
              <FileList fileList={fileList} />
            </div>
          ) : null}
          {inlineAudioList.length > 0 ? (
            <div className="not:last:border-dashed not:last:border-b flex w-full flex-wrap pb-2">
              {inlineAudioList.map((audio, idx) => {
                return <AudioPlayer key={idx} className="mb-2" src={audio} />
              })}
            </div>
          ) : null}
          {inlineImageList.length > 0 ? (
            <div className="flex flex-wrap gap-2 pb-2">
              {inlineImageList.map((image, idx) => {
                return (
                  <div key={idx} className="group/image relative cursor-pointer" onClick={() => openLightbox(idx)}>
                    {
                      // eslint-disable-next-line
                      <img className="max-h-48 rounded-sm" src={image} alt="inline-image" />
                    }
                    <Eye className="absolute left-1/2 top-1/2 -ml-4 -mt-4 h-8 w-8 text-white/80 opacity-0 group-hover/image:opacity-100" />
                  </div>
                )
              })}
            </div>
          ) : null}
          {!isEditing ? (
            <>
              {thoughtsHtml !== '' ? (
                <Accordion type="single" collapsible>
                  <AccordionItem value="thoughts">
                    <AccordionTrigger className="py-1">
                      <span className="flex text-slate-700">
                        {t('thoughts')}
                        {html === '' ? (
                          <LoaderCircle className="ml-2 mt-0.5 h-5 w-5 animate-spin" />
                        ) : (
                          t('expandThoughts')
                        )}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Magicdown>{thoughtsHtml}</Magicdown>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : null}
              <Magicdown>{html}</Magicdown>
              <div
                className={cn(
                  'flex gap-1 text-right opacity-0 transition-opacity duration-300 group-hover:opacity-100',
                  role === 'user' && chatLayout === 'chat' ? 'justify-start' : 'justify-end',
                )}
              >
                {id !== 'preview' ? (
                  <>
                    <IconButton
                      title={t(role === 'user' ? 'resend' : 'regenerate')}
                      onClick={() => handleRegenerate(id)}
                    >
                      <RotateCw className="h-4 w-4" />
                    </IconButton>
                    <IconButton title={t('edit')} onClick={() => setIsEditing(true)}>
                      <PencilLine className="h-4 w-4" />
                    </IconButton>
                    <IconButton title={t('delete')} onClick={() => handleDelete(id)}>
                      <Eraser className="h-4 w-4" />
                    </IconButton>
                  </>
                ) : null}
                {hasTextContent ? (
                  <>
                    <IconButton title={t('copy')} className={`copy-${id}`} onClick={() => handleCopy()}>
                      {isCopyed ? <CopyCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </IconButton>
                    <IconButton title={t('speak')} onClick={() => handleSpeak(content)}>
                      <Volume2 className="h-4 w-4" />
                    </IconButton>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <EditableArea
              content={content}
              isEditing={isEditing}
              onChange={(editedContent) => handleEdit(id, editedContent)}
              onCancel={() => setIsEditing(false)}
            />
          )}
        </div>
      )
    }
  }

  useEffect(() => {
    const textParts = parts.filter((item) => !isUndefined(item.text))
    if (role === 'model' && textParts.length === 2) {
      if (textParts[0].text) {
        setThoughtsHtml(textParts[0].text)
      }
      if (textParts[1].text) {
        setHasTextContent(true)
        setHtml(textParts[1].text)
      }
    } else {
      const messageParts: string[] = []
      parts.forEach(async (part) => {
        if (part.text) {
          messageParts.push(part.text)
          setHasTextContent(true)
        }
      })
      setHtml(messageParts.join(''))
    }
  }, [id, role, content, parts, attachments])

  return (
    <>
      <Avatar className="h-8 w-8">
        <MessageAvatar />
      </Avatar>
      <MessageContent />
      <Lightbox
        open={showLightbox}
        close={() => setShowLightbox(false)}
        slides={inlineImageList.map((item) => ({ src: item }))}
        index={lightboxIndex}
        plugins={[LightboxFullscreen]}
      />
    </>
  )
}

export default memo(MessageItem)
