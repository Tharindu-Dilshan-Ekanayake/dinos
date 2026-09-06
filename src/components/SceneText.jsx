import { Suspense, forwardRef } from 'react'
import { Text } from '@react-three/drei'

/**
 * World-space text that cannot hold the world hostage.
 *
 * drei's `<Text>` suspends while its font loads, and with no `font` given
 * troika fetches Roboto from fonts.gstatic.com. Every one of those sat inside
 * the scene's single Suspense boundary, so *the entire 3D world* - ground,
 * dinos, lights, everything - waited on a third-party download before it drew
 * a single triangle. On a slow connection that is a long stare at nothing; on
 * a blocked or offline one it never renders at all, which is a blank game
 * rather than a game missing some labels.
 *
 * A boundary per label costs nothing and changes the failure from fatal to
 * cosmetic: the world comes up at once and the writing arrives when it can.
 */
const SceneText = forwardRef(function SceneText(props, ref) {
  return (
    <Suspense fallback={null}>
      <Text ref={ref} {...props} />
    </Suspense>
  )
})

export default SceneText
