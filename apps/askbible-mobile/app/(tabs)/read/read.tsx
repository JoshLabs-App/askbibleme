import { ReadCatalogScreen } from "../../../src/read/ReadCatalogScreen";

/** 独立目录页：章节页「目录」跳转到这里，不回圣经首页。 */
export default function ReadStandaloneCatalogPage() {
  return <ReadCatalogScreen homeMode={false} />;
}
