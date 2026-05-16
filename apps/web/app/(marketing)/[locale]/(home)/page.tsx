import { setRequestLocale } from "next-intl/server";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div>
      {/* Hero */}
      <section className="py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          开完会，纪要自动出现在
          <span className="text-blue-600">文件夹里</span>
        </h1>
        <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto">
          连接飞书应用，配置你的 LLM，会议结束后自动生成结构化纪要并创建飞书文档。
          不再手动整理，不再为飞书纪要付费。
        </p>
        <div className="mt-10 flex gap-4 justify-center">
          <a
            href="/auth/login"
            className="bg-gray-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            飞书登录
          </a>
          <a
            href="https://github.com/hymn07/lark-summary-pro"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-gray-300 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            GitHub
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">核心功能</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-semibold text-lg mb-2">自动生成</h3>
              <p className="text-gray-500 text-sm">
                会议结束后自动拉取妙记逐字稿，AI 生成结构化纪要，无需任何操作。
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-semibold text-lg mb-2">风格定制</h3>
              <p className="text-gray-500 text-sm">
                上传 1-3 篇示例纪要，AI 学习你的写作风格。支持排除规则和特殊要求。
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="font-semibold text-lg mb-2">自部署 · 免费</h3>
              <p className="text-gray-500 text-sm">
                开源、单租户自部署。用你自己的 LLM API Key，零额外成本。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">三步开始</h2>
          <div className="flex flex-col md:flex-row gap-8 max-w-3xl mx-auto text-center">
            <div className="flex-1">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">1</div>
              <h3 className="font-semibold">创建飞书应用</h3>
              <p className="text-gray-500 text-sm mt-1">在飞书开放平台创建应用，开通会议和文档权限</p>
            </div>
            <div className="flex-1">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">2</div>
              <h3 className="font-semibold">配置 LLM</h3>
              <p className="text-gray-500 text-sm mt-1">在管理后台添加模型提供商，支持 DeepSeek、OpenAI 等</p>
            </div>
            <div className="flex-1">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">3</div>
              <h3 className="font-semibold">部署上线</h3>
              <p className="text-gray-500 text-sm mt-1">Docker 一键部署，开完会纪要自动出现</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gray-900 text-white text-center">
        <h2 className="text-3xl font-bold mb-4">开源 · 自部署 · 免费</h2>
        <p className="text-gray-400 mb-8">用你自己的 LLM，零额外成本</p>
        <a
          href="https://github.com/hymn07/lark-summary-pro"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
        >
          GitHub →
        </a>
      </section>
    </div>
  );
}
