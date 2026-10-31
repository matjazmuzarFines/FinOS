import { Suspense } from "react";
import { PodatkiBaze } from "@/components/admin/PodatkiBaze";

export default function PodatkiBazeStran() {
  return (
    <Suspense>
      <PodatkiBaze />
    </Suspense>
  );
}
