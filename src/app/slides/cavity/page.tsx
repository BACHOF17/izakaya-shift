'use client'

import { useState } from 'react'

const slides = [
  {
    bg: 'bg-gradient-to-br from-blue-400 to-purple-500',
    content: (
      <div className="flex flex-col items-center gap-8">
        <p className="text-8xl">🦷</p>
        <h1 className="text-5xl font-extrabold text-white drop-shadow-lg">
          むしばって なに？
        </h1>
        <p className="text-2xl text-white/90">
          いっしょに まなぼう！
        </p>
      </div>
    ),
  },
  {
    bg: 'bg-gradient-to-br from-cyan-300 to-blue-400',
    content: (
      <div className="flex flex-col items-center gap-6">
        <p className="text-7xl">🦷✨</p>
        <h2 className="text-4xl font-bold text-white drop-shadow">
          はの つくり
        </h2>
        <div className="rounded-3xl bg-white/90 p-6 max-w-md text-center shadow-xl">
          <p className="text-xl text-gray-800 leading-relaxed">
            はの そとがわは<br />
            <span className="text-2xl font-bold text-blue-600">「エナメルしつ」</span><br />
            という とっても かたい<br />
            よろいで まもられているよ！
          </p>
          <div className="mt-4 text-lg text-gray-600">
            からだの なかで<br />いちばん かたいんだ💪
          </div>
        </div>
      </div>
    ),
  },
  {
    bg: 'bg-gradient-to-br from-green-300 to-teal-500',
    content: (
      <div className="flex flex-col items-center gap-6">
        <p className="text-7xl">🦠🦠🦠</p>
        <h2 className="text-4xl font-bold text-white drop-shadow">
          おくちの なかの バイキン
        </h2>
        <div className="rounded-3xl bg-white/90 p-6 max-w-md text-center shadow-xl">
          <p className="text-xl text-gray-800 leading-relaxed">
            おくちの なかには<br />
            <span className="text-2xl font-bold text-green-600">「ミュータンスきん」</span><br />
            という バイキンが いるよ。
          </p>
          <p className="mt-4 text-lg text-gray-600">
            この バイキンが<br />
            むしばを つくる はんにんだ！😈
          </p>
        </div>
      </div>
    ),
  },
  {
    bg: 'bg-gradient-to-br from-yellow-300 to-orange-400',
    content: (
      <div className="flex flex-col items-center gap-6">
        <p className="text-7xl">🦠 + 🍭🍫🍩</p>
        <h2 className="text-4xl font-bold text-white drop-shadow">
          バイキンは あまいものが だいすき！
        </h2>
        <div className="rounded-3xl bg-white/90 p-6 max-w-md text-center shadow-xl">
          <p className="text-xl text-gray-800 leading-relaxed">
            おかしや ジュースの<br />
            <span className="text-2xl font-bold text-orange-500">「さとう」</span>を たべて<br />
            バイキンは どんどん ふえるよ！
          </p>
          <p className="mt-4 text-lg text-gray-600">
            たべかすが はに のこると<br />
            バイキンの ごちそうに なっちゃう🍽️
          </p>
        </div>
      </div>
    ),
  },
  {
    bg: 'bg-gradient-to-br from-red-400 to-pink-500',
    content: (
      <div className="flex flex-col items-center gap-6">
        <p className="text-7xl">🦠💨→🦷💥</p>
        <h2 className="text-4xl font-bold text-white drop-shadow">
          バイキンが「さん」をだす！
        </h2>
        <div className="rounded-3xl bg-white/90 p-6 max-w-md text-center shadow-xl">
          <p className="text-xl text-gray-800 leading-relaxed">
            さとうを たべた バイキンは<br />
            <span className="text-2xl font-bold text-red-500">「さん」</span>という<br />
            はを とかす ものを だすよ。
          </p>
          <p className="mt-4 text-lg text-gray-600">
            この「さん」が<br />
            かたい エナメルしつを<br />
            すこしずつ とかしていくんだ😱
          </p>
        </div>
      </div>
    ),
  },
  {
    bg: 'bg-gradient-to-br from-gray-500 to-gray-700',
    content: (
      <div className="flex flex-col items-center gap-6">
        <p className="text-7xl">🦷🕳️😭</p>
        <h2 className="text-4xl font-bold text-white drop-shadow">
          むしばの できあがり
        </h2>
        <div className="rounded-3xl bg-white/90 p-6 max-w-md text-center shadow-xl">
          <p className="text-xl text-gray-800 leading-relaxed">
            「さん」で はに<br />
            <span className="text-2xl font-bold text-gray-700">あな</span>が あいちゃう。<br />
            これが <span className="text-2xl font-bold text-red-600">「むしば」</span>だよ！
          </p>
          <p className="mt-4 text-lg text-gray-600">
            あなが おおきくなると<br />
            いたく なっちゃうよ😢
          </p>
        </div>
      </div>
    ),
  },
  {
    bg: 'bg-gradient-to-br from-emerald-400 to-green-600',
    content: (
      <div className="flex flex-col items-center gap-6">
        <p className="text-7xl">🪥✨🦷</p>
        <h2 className="text-4xl font-bold text-white drop-shadow">
          むしばを ふせぐには？
        </h2>
        <div className="rounded-3xl bg-white/90 p-6 max-w-md text-center shadow-xl space-y-4">
          <div className="flex items-center gap-3 text-xl text-gray-800">
            <span className="text-3xl">①</span>
            <span>はみがきを <span className="font-bold text-green-600">まいにち</span> しよう！</span>
          </div>
          <div className="flex items-center gap-3 text-xl text-gray-800">
            <span className="text-3xl">②</span>
            <span>おかしを たべすぎない！🍬</span>
          </div>
          <div className="flex items-center gap-3 text-xl text-gray-800">
            <span className="text-3xl">③</span>
            <span>はいしゃさんに みてもらおう！🏥</span>
          </div>
          <div className="flex items-center gap-3 text-xl text-gray-800">
            <span className="text-3xl">④</span>
            <span><span className="font-bold text-green-600">フッそ</span>で はを つよくしよう！💪</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    bg: 'bg-gradient-to-br from-pink-400 to-purple-500',
    content: (
      <div className="flex flex-col items-center gap-6">
        <p className="text-7xl">🦷🌟😁</p>
        <h2 className="text-4xl font-bold text-white drop-shadow">
          まとめ
        </h2>
        <div className="rounded-3xl bg-white/90 p-6 max-w-md text-center shadow-xl">
          <div className="text-xl text-gray-800 leading-relaxed space-y-3">
            <p>🦠 バイキンが さとうを たべる</p>
            <p className="text-2xl">⬇️</p>
            <p>💨 「さん」を だす</p>
            <p className="text-2xl">⬇️</p>
            <p>🕳️ はに あなが あく</p>
            <p className="text-2xl">⬇️</p>
            <p>😭 むしばに なる！</p>
          </div>
          <p className="mt-6 text-2xl font-bold text-purple-600">
            はみがきで バイキンを<br />やっつけよう！🪥✨
          </p>
        </div>
      </div>
    ),
  },
]

export default function CavitySlidesPage() {
  const [current, setCurrent] = useState(0)
  const total = slides.length

  const goNext = () => setCurrent((prev) => Math.min(prev + 1, total - 1))
  const goPrev = () => setCurrent((prev) => Math.max(prev - 1, 0))

  return (
    <div
      className={`min-h-dvh flex flex-col ${slides[current].bg} transition-all duration-500`}
    >
      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center p-6">
        {slides[current].content}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between p-4 pb-8">
        <button
          onClick={goPrev}
          disabled={current === 0}
          className="rounded-full bg-white/30 px-6 py-3 text-2xl font-bold text-white backdrop-blur disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/50 active:scale-95 transition-all"
        >
          ◀ もどる
        </button>

        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-3 w-3 rounded-full transition-all ${
                i === current ? 'bg-white scale-125' : 'bg-white/40'
              }`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={current === total - 1}
          className="rounded-full bg-white/30 px-6 py-3 text-2xl font-bold text-white backdrop-blur disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/50 active:scale-95 transition-all"
        >
          つぎへ ▶
        </button>
      </div>
    </div>
  )
}
