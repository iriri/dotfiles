filet indent on
filet plugin off
set bs=2
set nu
set nois
set hls
set et
set sts=3
set ai
set sw=3
set vb
set t_vb=
set hid
set nowrap
set list
set lcs=tab:>-,trail:~,precedes:<,extends:>
set ls=2
set stl=[%n:\%f]%m%r%w%y[%{&ff}][%{&enc}]%=[%l,%v][%P]
set cul
hi CursorLine cterm=NONE ctermfg=NONE ctermbg=0
set cc=80
hi ColorColumn cterm=NONE ctermfg=NONE ctermbg=0
set wim=longest,list,full

au BufReadPost *
 \ if line("'\"") >= 1 && line("'\"") <= line('$') && &ft !~# 'commit' |
 \    exe "normal! g`\""                                               |
 \ endif

au FileType cpp,fsharp,gluon set cc=100
au FileType rust             set cc=101
au FileType cpp,fsharp,rust  set mps+=<:>

au FileType go,mbld,myr
 \ setl noet  |
 \ setl sts=8 |
 \ setl sw=8  |
 \ setl cc=100
