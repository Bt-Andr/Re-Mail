import { useEffect } from 'react'

// Pose la classe "is-scrolling" sur <html> pendant un scroll actif (n'importe où
// dans l'app, y compris dans des conteneurs imbriqués) et la retire après un court
// délai d'inactivité — pilote le fondu des scrollbars flottantes (voir index.css).
export function useGlobalScrollFade(idleDelayMs = 700) {
  useEffect(() => {
    const root = document.documentElement
    let timeout: ReturnType<typeof setTimeout>

    const onScroll = () => {
      root.classList.add('is-scrolling')
      clearTimeout(timeout)
      timeout = setTimeout(() => root.classList.remove('is-scrolling'), idleDelayMs)
    }

    // capture: true — l'événement "scroll" ne bubble pas, mais la phase de capture
    // depuis window atteint quand même les conteneurs scrollables imbriqués.
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      clearTimeout(timeout)
    }
  }, [idleDelayMs])
}
