import { Children, isValidElement, type ChangeEvent, type ChangeEventHandler, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MaterialStep } from '../../packages/workbench/src/demo/components/MaterialStep.js'
import { initialDemoState } from '../../packages/workbench/src/demo/state.js'

// This unit exercises the real component's File handler, not React mounting/state updates.
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => [initial, () => {}],
}))

function fileInputHandler(node: ReactNode): ChangeEventHandler<HTMLInputElement> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ id?: string; children?: ReactNode; onChange?: ChangeEventHandler<HTMLInputElement> }>(child)) continue
    if (child.props.id === 'material-file') return child.props.onChange
    const handler = fileInputHandler(child.props.children)
    if (handler) return handler
  }
}

function selectFile(file: File) {
  const onAccept = vi.fn()
  const onFailure = vi.fn()
  const tree = MaterialStep({ state: initialDemoState, syntheticInterviewText: '合成访谈', onTitleChange: () => {}, onAccept, onAnalyze: () => {}, onFailure })
  const handler = fileInputHandler(tree)
  if (!handler) throw new Error('Material file input handler is missing')
  handler({ target: { files: [file], value: file.name } } as unknown as ChangeEvent<HTMLInputElement>)
  return { onAccept, onFailure }
}

describe('MaterialStep file reads', () => {
  it('rejects an oversized file before invoking arrayBuffer', async () => {
    const file = new File([new Uint8Array(262_145)], 'oversize.txt', { type: 'text/plain' })
    const read = vi.spyOn(file, 'arrayBuffer')
    const { onAccept, onFailure } = selectFile(file)

    await vi.waitFor(() => expect(onFailure).toHaveBeenCalledWith('上传文件不能超过 256 KB。'))
    expect(read).not.toHaveBeenCalled()
    expect(onAccept).not.toHaveBeenCalled()
  })

  it('reads an in-limit file and preserves its validated text and filename', async () => {
    const file = new File(['受访者：合成访谈内容。'], 'interview.md', { type: 'text/markdown' })
    const read = vi.spyOn(file, 'arrayBuffer')
    const { onAccept, onFailure } = selectFile(file)

    await vi.waitFor(() => expect(onAccept).toHaveBeenCalledWith({ text: '受访者：合成访谈内容。', displayName: 'interview.md', format: 'text/markdown' }))
    expect(read).toHaveBeenCalledOnce()
    expect(onFailure).not.toHaveBeenCalled()
  })
})
