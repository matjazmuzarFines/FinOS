import { Suspense } from "react";
import { ListZaposlenega } from "@/components/admin/ListZaposlenega";

export default async function ZaposleniList({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ListZaposlenega id={Number(id)} />
    </Suspense>
  );
}
