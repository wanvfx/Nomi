import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// 把项目自定义字号 token(tailwind.config fontSize:micro/caption/body/body-sm/title)注册进 twMerge 的
// font-size 组。否则原版 twMerge 不认它们,会把 `text-micro` 误判成与 `text-nomi-ink-*`(颜色)同组冲突,
// 按出现顺序丢掉其一 —— 导致 `cn('text-micro ... text-nomi-ink-60')` 里 text-micro 被吞、字号回退 16px。
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'caption', 'body', 'body-sm', 'title'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
