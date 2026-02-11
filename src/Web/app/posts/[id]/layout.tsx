import { ReactNode } from 'react';

export function generateStaticParams(): { id: string }[] {
    return [{ id: '0' }];
}

export default function PostIdLayout({
    children,
}: {
    children: ReactNode;
}) {
    return <>{children}</>;
}
