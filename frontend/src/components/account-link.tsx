"use client";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";
const API=process.env.NEXT_PUBLIC_API_URL??"http://localhost:4000";
type User={name:string;email:string;role:"ADMIN"|"CUSTOMER"};
export function AccountLink({compact=false}:{compact?:boolean}){const [user,setUser]=useState<User|null|undefined>(undefined);useEffect(()=>{fetch(API+"/api/auth/me",{credentials:"include"}).then(async r=>setUser(r.ok?(await r.json()).user:null)).catch(()=>setUser(null));},[]);if(user===undefined)return <span className="account-link account-loading"><UserRound/></span>;if(!user)return <Link className="account-link guest-account" href="/login" aria-label="Entrar"><UserRound/><span>{compact?"":"Entrar"}</span></Link>;const shortName=user.name.trim().split(/\s+/).slice(0,2).join(" ");return <Link className="account-link signed-in" href="/account" title={"Abrir perfil de "+user.name}><UserRound/><span>Olá, <strong>{shortName}</strong></span></Link>}

