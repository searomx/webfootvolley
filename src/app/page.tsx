'use client';
import Image from "next/image";
import competitionPoster from "../../public/images/img_footvolley.jpeg";
import { RegistrationProvider } from "@/components/registration-provider";
import { RegistrationForm } from "@/components/registration-form";
import favicon from "../../public/images/favicon.jpg";

export default function Home() {
  <Image src={favicon} alt="Favicon" width={32} height={32} />
  return (
    <>
      <header className="competition-header">
        <Image
          src={competitionPoster}
          alt="Cartaz da Liga Interna CB 2026: última etapa em 28 e 29 de novembro, inscrições abertas."
          unoptimized
          preload
        />
      </header>
      <main className="registration-page">
        <p className="registration-promotion">Primeiro lote disponível até 15 de novembro!</p>
        <h1>Liga Interna de Futevôlei — 3ª etapa — Contorno da Bola</h1>
        <p className="competition-date">28 e 29 de novembro de 2026</p>
        <p className="page-intro">Cadastre seus dados, escolha as categorias e confira o valor da inscrição.</p>
        <RegistrationProvider><RegistrationForm /></RegistrationProvider>
      </main>
      <footer className="competition-footer">Footvolley 2026 · Inscrição de atletas</footer>
    </>
  );
}
