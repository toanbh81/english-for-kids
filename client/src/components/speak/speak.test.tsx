import { render, screen } from '@testing-library/react'
import { MicButton, Countdown, LevelBars } from './index'

describe('MicButton', () => {
  it('idle is 124 on a phone and 150 from md, with the mic shadow', () => {
    render(<MicButton state="idle" level={0} onPress={() => {}} />)
    const b = screen.getByRole('button', { name: 'Bấm để nói' })
    expect(b).toHaveClass('h-[124px]', 'w-[124px]', 'md:h-[150px]', 'md:w-[150px]', 'shadow-mic')
    expect(screen.getByText('Chạm để nói nào!')).toBeInTheDocument()
  })
  it('recording grows to 150/190, shows two halos, level bars and the countdown instead of the caption', () => {
    render(<MicButton state="recording" level={0.5} onPress={() => {}} secondsLeft={13} />)
    const b = screen.getByRole('button', { name: 'Dừng' })
    expect(b).toHaveClass('h-[150px]', 'md:h-[190px]')
    expect(screen.getAllByTestId('mic-halo')).toHaveLength(2)
    expect(screen.getAllByTestId('level-bar')).toHaveLength(7)
    expect(screen.getByTestId('countdown')).toHaveTextContent('13')
    expect(screen.queryByText('Chạm để nói nào!')).toBeNull()
  })
  it('disabled shows the dashed spinner and the preparing caption; processing the hourglass', () => {
    const { rerender } = render(<MicButton state="disabled" level={0} onPress={() => {}} />)
    expect(screen.getByTestId('mic-spinner')).toHaveClass('animate-spin', 'border-dashed')
    expect(screen.getByText('Đang chuẩn bị máy chấm…')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
    rerender(<MicButton state="processing" level={0} onPress={() => {}} />)
    expect(screen.getByRole('button', { name: 'Đang chấm…' })).toHaveTextContent('⏳')
    expect(screen.getByText('Foxy đang chấm…')).toBeInTheDocument()
  })
  it('locked is disabled with the moon caption', () => {
    render(<MicButton state="locked" level={0} onPress={() => {}} />)
    expect(screen.getByRole('button', { name: 'Hôm nay đã hết giờ' })).toBeDisabled()
  })
})

describe('Countdown', () => {
  it('is a 96px disc; two digits tighten the letter-spacing', () => {
    const { rerender } = render(<Countdown seconds={6} />)
    expect(screen.getByTestId('countdown')).toHaveClass('h-24', 'w-24', 'text-[44px]', 'bg-peach-50')
    rerender(<Countdown seconds={13} />)
    expect(screen.getByTestId('countdown')).toHaveClass('tracking-[-2px]')
  })
})

describe('LevelBars', () => {
  it('scales its seven bars with the level', () => {
    render(<LevelBars level={1} />)
    const bars = screen.getAllByTestId('level-bar')
    expect(bars[2]).toHaveStyle({ height: '28px' })
  })
})
