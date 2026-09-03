import { render, screen, fireEvent } from '@testing-library/react'
import { SoundTier } from './SoundTier'

describe('SoundTier', () => {
  it('lays out the mouth tile, IPA and speaker at the phone/iPad sizes, 560 wide by default', () => {
    render(<SoundTier ph="th" ipa="θ" tip="Đặt lưỡi giữa hai hàm răng" onPlay={() => {}} />)

    const card = screen.getByTestId('sound-tier')
    expect(card).toHaveClass('bg-peach-50', 'rounded-r20', 'px-3.5', 'py-3', 'shadow-[0_6px_0_#F2DFC9]')
    expect(card).toHaveClass('md:max-w-[560px]', 'md:rounded-r24', 'md:px-5', 'md:py-4')
    expect(card).not.toHaveClass('md:max-w-[640px]')

    const mouth = screen.getByTestId('mouth-tile')
    expect(mouth).toHaveClass('h-14', 'w-14', 'rounded-r16', 'bg-white', 'text-[30px]')
    expect(mouth).toHaveClass('md:h-16', 'md:w-16')
    expect(mouth.querySelector('span')).not.toHaveClass('animate-wiggle')

    expect(screen.getByText('/θ/')).toHaveClass('text-[40px]', 'text-[#C08457]', 'md:text-[72px]')

    const speaker = screen.getByRole('button', { name: 'Nghe âm lẻ' })
    expect(speaker).toHaveClass('h-14', 'w-14', 'rounded-full', 'bg-teal-500', 'md:h-16', 'md:w-16')

    const tip = screen.getByText('Đặt lưỡi giữa hai hàm răng')
    expect(tip).toHaveClass('text-[13px]', 'text-sun-700', 'line-clamp-2', 'md:text-[17px]')
  })

  it('widens to 640 on iPad when asked (B2)', () => {
    render(<SoundTier ph="th" ipa="θ" onPlay={() => {}} mdWide />)
    expect(screen.getByTestId('sound-tier')).toHaveClass('md:max-w-[640px]')
    expect(screen.getByTestId('sound-tier')).not.toHaveClass('md:max-w-[560px]')
  })

  it('renders with no tip and no audio-missing note by default', () => {
    render(<SoundTier ph="th" ipa="θ" onPlay={() => {}} />)
    expect(screen.queryByText('Chưa có audio âm này')).not.toBeInTheDocument()
  })

  it('says so when the isolated sound sample is missing', () => {
    render(<SoundTier ph="th" ipa="θ" onPlay={() => {}} audioMissing />)
    expect(screen.getByText('Chưa có audio âm này')).toBeInTheDocument()
  })

  it('wiggles the mouth tile only while recording', () => {
    const { rerender } = render(<SoundTier ph="th" ipa="θ" onPlay={() => {}} />)
    expect(screen.getByTestId('mouth-tile').querySelector('span')).not.toHaveClass('animate-wiggle')

    rerender(<SoundTier ph="th" ipa="θ" onPlay={() => {}} wiggle />)
    expect(screen.getByTestId('mouth-tile').querySelector('span')).toHaveClass('animate-wiggle')
  })

  it('plays the isolated sound on tap', () => {
    const onPlay = vi.fn()
    render(<SoundTier ph="th" ipa="θ" onPlay={onPlay} />)
    fireEvent.click(screen.getByRole('button', { name: 'Nghe âm lẻ' }))
    expect(onPlay).toHaveBeenCalledTimes(1)
  })
})
